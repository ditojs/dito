import Koa from 'koa'
import mount from 'koa-mount'
import { handleConnectMiddleware } from './handleConnectMiddleware.js'

async function serve(app, callback) {
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const { port } = server.address()
    return await callback(`http://localhost:${port}`)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

function createApp(connectMiddleware, options = {}) {
  const app = new Koa()
  app.use(handleConnectMiddleware(connectMiddleware, options))
  return app
}

describe('handleConnectMiddleware()', () => {
  it('sends the body passed to `res.end()`', async () => {
    const app = createApp((req, res) => {
      res.statusCode = 201
      res.setHeader('X-Recipe', 'soup')
      res.end('done')
    })
    await serve(app, async url => {
      const response = await fetch(url)
      expect(response.status).toBe(201)
      expect(response.headers.get('x-recipe')).toBe('soup')
      expect(await response.text()).toBe('done')
    })
  })

  it('sets the status through the response object', async () => {
    let seen = null
    const app = createApp((req, res) => {
      res.statusCode = 202
      seen = { statusCode: res.statusCode, locals: res.locals }
      res.end()
    })
    await serve(app, async url => {
      expect((await fetch(url)).status).toBe(202)
    })
    expect(seen).toEqual({ statusCode: 202, locals: {} })
  })

  it('reads response headers through `res.getHeader()`', async () => {
    let header = null
    const app = new Koa()
    app.use(async (ctx, next) => {
      ctx.set('X-Before', 'yes')
      await next()
    })
    app.use(
      handleConnectMiddleware((req, res) => {
        header = res.getHeader('X-Before')
        res.end()
      }, {})
    )
    await serve(app, async url => {
      await fetch(url)
    })
    expect(header).toBe('yes')
  })

  it('appends values to existing headers', async () => {
    const app = createApp((req, res) => {
      res.setHeader('Vary', 'Accept')
      res.appendHeader('Vary', 'Origin')
      res.end('')
    })
    await serve(app, async url => {
      const response = await fetch(url)
      expect(response.headers.get('vary')).toBe('Accept, Origin')
    })
  })

  it('supports `writeHead()` with a status message and headers', async () => {
    const app = createApp((req, res) => {
      res.writeHead(200, 'cooked', { 'X-Pot': 'big' })
      res.end()
    })
    await serve(app, async url => {
      const response = await fetch(url)
      expect(response.headers.get('x-pot')).toBe('big')
      expect(await response.text()).toBe('cooked')
    })
  })

  it('supports `writeHead()` with raw header arrays', async () => {
    const app = createApp((req, res) => {
      res.writeHead(203, ['X-Pot', 'big', 'X-Lid', 'glass'])
      res.end('raw')
    })
    await serve(app, async url => {
      const response = await fetch(url)
      expect(response.status).toBe(203)
      expect(response.headers.get('x-pot')).toBe('big')
      expect(response.headers.get('x-lid')).toBe('glass')
    })
  })

  it('streams the chunks passed to `res.write()`', async () => {
    const app = createApp((req, res) => {
      res.setHeader('Content-Type', 'text/plain')
      res.write('salt, ')
      res.write('pepper')
      res.end()
    })
    await serve(app, async url => {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) })
      expect(await response.text()).toBe('salt, pepper')
    })
  })

  it('passes requests on to the next Koa middleware', async () => {
    const app = new Koa()
    app.use(handleConnectMiddleware((req, res, next) => next(), {}))
    app.use(ctx => {
      ctx.body = 'koa'
    })
    await serve(app, async url => {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) })
      expect(await response.text()).toBe('koa')
    })
  })

  it('passes errors of the connect middleware on to Koa', async () => {
    const errors = []
    const app = new Koa()
    app.use(async (ctx, next) => {
      try {
        await next()
      } catch (error) {
        errors.push(error.message)
        ctx.status = 500
      }
    })
    app.use(
      handleConnectMiddleware(
        (req, res, next) => next(new Error('Burnt')),
        {}
      )
    )
    await serve(app, async url => {
      expect((await fetch(url)).status).toBe(500)
    })
    expect(errors).toEqual(['Burnt'])
  })

  it('restores the mounted url for the next Koa middleware', async () => {
    const app = new Koa()
    app.use(
      mount(
        '/kitchen',
        new Koa()
          .use(
            handleConnectMiddleware(
              (req, res, next) => {
                req.url = '/rewritten'
                next()
              },
              { expandMountPath: true }
            )
          )
          .use(ctx => {
            ctx.body = ctx.url
          })
      )
    )
    await serve(app, async url => {
      const response = await fetch(`${url}/kitchen/pots`)
      expect(await response.text()).toBe('/pots')
    })
  })

  it('passes the mounted path without `expandMountPath`', async () => {
    const app = new Koa()
    app.use(
      mount(
        '/kitchen',
        createApp((req, res) => res.end(req.url))
      )
    )
    await serve(app, async url => {
      const response = await fetch(`${url}/kitchen/pots`)
      expect(await response.text()).toBe('/pots')
    })
  })

  it('passes the full path with `expandMountPath`', async () => {
    const app = new Koa()
    app.use(
      mount(
        '/kitchen',
        createApp((req, res) => res.end(req.url), { expandMountPath: true })
      )
    )
    await serve(app, async url => {
      const response = await fetch(`${url}/kitchen/pots`)
      expect(await response.text()).toBe('/kitchen/pots')
    })
  })
})
