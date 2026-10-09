import { vi } from 'vitest'
import { Readable } from 'stream'
import Koa from 'koa'
import { logRequests } from './logRequests.js'

function createLogger({ levels = ['info', 'warn'] } = {}) {
  const entries = []
  const logger = {
    entries,
    bindings: {},
    child(bindings) {
      return { ...logger, bindings: { ...logger.bindings, ...bindings } }
    },
    isLevelEnabled: level => levels.includes(level)
  }
  for (const level of ['trace', 'info', 'warn']) {
    logger[level] = function (data, message) {
      entries.push({
        level,
        name: this.bindings.name,
        // Strip the color codes from the message.
        // eslint-disable-next-line no-control-regex
        message: message.replace(/\x1b\[\d+m/g, ''),
        hasRequest: !!data.req,
        hasResponse: !!data.res
      })
    }
  }
  return logger
}

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

function createApp(logger, handler, options) {
  const app = new Koa()
  app.silent = true
  app.use((ctx, next) => {
    ctx.logger = logger
    return next()
  })
  app.use(logRequests(options))
  app.use(handler)
  return app
}

// The response is logged on 'finish', after the client may have received it.
const waitForEntries = async (logger, count) => {
  await vi.waitFor(() => expect(logger.entries).toHaveLength(count))
  return logger.entries
}

describe('logRequests()', () => {
  it('logs the method, url, status, time and length of responses', async () => {
    const logger = createLogger()
    const app = createApp(logger, ctx => {
      ctx.body = { dish: 'soup' }
    })
    await serve(app, async url => {
      await (await fetch(`${url}/dishes?hot=1`)).text()
    })
    const [entry] = await waitForEntries(logger, 1)
    expect(entry).toMatchObject({
      level: 'info',
      name: 'http',
      hasRequest: true,
      hasResponse: true
    })
    expect(entry.message).toMatch(
      /^GET \/dishes\?hot=1 200 \d+(\.\d+)?ms 15b$/
    )
  })

  it('logs incoming requests at the trace level', async () => {
    const logger = createLogger({ levels: ['trace', 'info'] })
    const app = createApp(logger, ctx => {
      ctx.body = 'ok'
    })
    await serve(app, async url => {
      await (await fetch(`${url}/dishes`)).text()
    })
    const entries = await waitForEntries(logger, 2)
    expect(entries[0]).toMatchObject({
      level: 'trace',
      message: '<-- GET /dishes',
      hasRequest: true,
      hasResponse: false
    })
    expect(entries[1].level).toBe('info')
  })

  it('omits the length of responses without content', async () => {
    const logger = createLogger()
    const app = createApp(logger, ctx => {
      ctx.status = 204
    })
    await serve(app, async url => {
      await fetch(url)
    })
    const [entry] = await waitForEntries(logger, 1)
    expect(entry.message).toMatch(/^GET \/ 204 \S+ $/)
  })

  it('logs 404 responses of unhandled requests', async () => {
    const logger = createLogger()
    const app = createApp(logger, () => {})
    await serve(app, async url => {
      await (await fetch(`${url}/missing`)).text()
    })
    const [entry] = await waitForEntries(logger, 1)
    expect(entry.message).toMatch(/^GET \/missing 404 /)
  })

  it('counts the length of streamed responses', async () => {
    const logger = createLogger()
    const app = createApp(logger, ctx => {
      ctx.type = 'text/plain'
      ctx.body = Readable.from(['salt', 'pepper'])
    })
    await serve(app, async url => {
      expect(await (await fetch(url)).text()).toBe('saltpepper')
    })
    const [entry] = await waitForEntries(logger, 1)
    expect(entry.message).toMatch(/ 10b$/)
  })

  it('aborts counted responses when their stream fails', async () => {
    const logger = createLogger()
    const app = createApp(logger, ctx => {
      ctx.type = 'text/plain'
      ctx.body = new Readable({
        read() {
          this.push('salt')
          setTimeout(() => this.destroy(new Error('Too salty')), 10)
        }
      })
    })
    await serve(app, async url => {
      const response = await fetch(url)
      await expect(response.text()).rejects.toThrow()
    })
    await waitForEntries(logger, 1)
  })

  it('logs errors at the warn level and passes them on', async () => {
    const logger = createLogger()
    const errors = []
    const app = new Koa()
    app.use(async (ctx, next) => {
      ctx.logger = logger
      try {
        await next()
      } catch (error) {
        errors.push(error)
        ctx.status = error.status
      }
    })
    app.use(logRequests())
    app.use(() => {
      throw Object.assign(new Error('Too salty'), { status: 422 })
    })
    await serve(app, async url => {
      expect((await fetch(url, { method: 'POST' })).status).toBe(422)
    })
    const [entry] = await waitForEntries(logger, 1)
    expect(entry.level).toBe('warn')
    expect(entry.message).toMatch(/^POST \/ 422 \S+ -$/)
    expect(errors.map(error => error.message)).toEqual(['Too salty'])
  })

  it('logs errors without a status as 500', async () => {
    const logger = createLogger()
    const app = createApp(logger, () => {
      throw new Error('Burnt')
    })
    await serve(app, async url => {
      expect((await fetch(url)).status).toBe(500)
    })
    const [entry] = await waitForEntries(logger, 1)
    expect(entry.message).toMatch(/^GET \/ 500 /)
  })

  it('formats long response times in seconds', async () => {
    const logger = createLogger()
    vi.useFakeTimers({ toFake: ['performance'] })
    const app = createApp(logger, ctx => {
      vi.advanceTimersByTime(12_345)
      ctx.body = 'slow'
    })
    try {
      await serve(app, async url => {
        await (await fetch(url)).text()
      })
      const [entry] = await waitForEntries(logger, 1)
      expect(entry.message).toMatch(/ 12\.35s 4b$/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips requests that match `ignoreUrlPattern`', async () => {
    const logger = createLogger()
    const app = createApp(
      logger,
      ctx => {
        ctx.body = 'ok'
      },
      { ignoreUrlPattern: /\.js$/ }
    )
    await serve(app, async url => {
      await (await fetch(`${url}/main.js`)).text()
      await (await fetch(`${url}/main.css`)).text()
    })
    const entries = await waitForEntries(logger, 1)
    expect(entries[0].message).toMatch(/^GET \/main\.css 200/)
  })

  it('skips logging for disabled levels', async () => {
    const logger = createLogger({ levels: [] })
    const app = createApp(logger, ctx => {
      ctx.body = 'ok'
    })
    await serve(app, async url => {
      await (await fetch(url)).text()
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(logger.entries).toEqual([])
  })
})
