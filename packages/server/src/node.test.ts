import type { AddressInfo } from 'node:net'
import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { createErrorHandler } from './errors.ts'
import { forwarded, honoMiddleware } from './hono.ts'
import { createApi, createHono, HttpError } from './index.ts'
import { getClientAddress, serve } from './node.ts'

function getUrl(server: { address(): unknown }) {
  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}`
}

// Serves `app` on Node for `fn`.
async function withServer(app: Hono, fn: (url: string) => Promise<void>) {
  const { server, close } = await serve(app, { host: '127.0.0.1' })
  try {
    await fn(getUrl(server))
  } finally {
    await close()
  }
}

// An app that returns the URL, the body and the client's address.
function echo(proxy?: boolean | number) {
  const app = new Hono()
  if (proxy !== undefined) app.use(forwarded(proxy))
  app.all('/*', async c =>
    c.json({
      url: c.req.url,
      body: await c.req.text(),
      address: getClientAddress(c) ?? null
    })
  )
  return app
}

const headers = {
  'X-Forwarded-Proto': 'http, https',
  'X-Forwarded-Host': 'spoofed.test, shop.test',
  'X-Forwarded-For': '203.0.113.7, 10.0.0.1'
}

describe('honoMiddleware() on Node', () => {
  // Answers `/secret` with 401, without reading the body.
  const hono = (proxy?: boolean) => {
    const app = new Hono()
    app.onError(createErrorHandler())
    if (proxy) app.use(forwarded(proxy))
    app.use(...honoMiddleware())
    app.post('/secret', c => c.text('Unauthorized', 401))
    app.get('/', c => c.text('ok'))
    return app
  }

  // Keep-alive connections fail on the next request when the server resets
  // them, which takes a few rounds to show.
  async function expectOpenConnections(
    size: number,
    status: number,
    proxy?: boolean
  ) {
    await withServer(hono(proxy), async url => {
      for (let i = 0; i < 30; i++) {
        const response = await fetch(`${url}/secret`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(proxy && { 'X-Forwarded-Proto': 'https' })
          },
          body: 'x'.repeat(size)
        })
        expect(response.status).toBe(status)
        await response.text()
        expect((await fetch(url)).status).toBe(200)
      }
    })
  }

  it('keeps connections usable after an unread body', async () => {
    await expectOpenConnections(900_000, 401)
  })

  it('keeps connections usable after a body over the limit', async () => {
    await expectOpenConnections(1_100_000, 413)
  })

  it('keeps connections usable after an unread body behind a proxy', async () => {
    await expectOpenConnections(900_000, 401, true)
  })
})

describe('createHono()', () => {
  it('routes paths with a trailing slash, and answers errors as JSON', async () => {
    const hono = createHono()
    hono.get('/books', c => c.text('books'))
    hono.get('/fail', () => {
      throw new HttpError(409, { message: 'Taken' })
    })
    expect(await (await hono.request('/books/')).text()).toBe('books')
    const missing = await hono.request('/authors')
    expect(await missing.json()).toEqual({ message: 'Not Found', status: 404 })
    const failed = await hono.request('/fail')
    expect(await failed.json()).toEqual({ message: 'Taken', status: 409 })
  })

  it('reads the public URL before `csrf()` checks the origin', async () => {
    const post = (hono: Hono) =>
      hono.request('http://backend/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://shop.test',
          'X-Forwarded-Proto': 'https',
          'X-Forwarded-Host': 'shop.test'
        }
      })
    const hono = (proxy?: boolean) => {
      const hono = createHono({ proxy })
      hono.post('/books', c => c.text(c.req.url))
      return hono
    }
    expect(await (await post(hono(true))).text()).toBe(
      'https://shop.test/books'
    )
    expect((await post(hono())).status).toBe(403)
  })

  it('takes the options of `honoMiddleware()`', async () => {
    const hono = createHono({ etag: true, secureHeaders: false })
    hono.get('/books', c => c.text('books'))
    const response = await hono.request('/books')
    expect(response.headers.has('ETag')).toBe(true)
    expect(response.headers.has('X-Content-Type-Options')).toBe(false)
  })
})

describe('serve()', () => {
  it('runs the services around the server, in reverse on `close()`', async () => {
    const log: string[] = []
    const service = (name: string) => ({
      start: () => void log.push(`${name} start`),
      stop: () => void log.push(`${name} stop`)
    })
    const { server, close } = await serve(new Hono(), {
      host: '127.0.0.1',
      services: [service('first'), {}, service('second')]
    })
    expect(server.listening).toBe(true)
    await close()
    expect(log).toEqual([
      'first start',
      'second start',
      'second stop',
      'first stop'
    ])
  })

  it('serves the app until `close()`, and then stops the services', async () => {
    const app = new Hono()
    app.get('/', c => c.text('Hello'))
    const onClose = vi.fn()
    const { server, close } = await serve(app, {
      host: '127.0.0.1',
      services: [{ stop: onClose }]
    })
    expect(await (await fetch(getUrl(server))).text()).toBe('Hello')
    await close()
    expect(server.listening).toBe(false)
    expect(onClose).toHaveBeenCalledOnce()
    // A second call waits for the same close.
    await close()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('fails to close after `closeTimeout`', async () => {
    const { close } = await serve(new Hono(), {
      closeTimeout: 10,
      services: [
        { stop: () => new Promise(resolve => setTimeout(resolve, 100)) }
      ]
    })
    await expect(close()).rejects.toThrow(
      'Timeout reached while stopping the server (10ms)'
    )
  })

  it('takes `closeTimeout` as a duration', async () => {
    const { close } = await serve(new Hono(), {
      closeTimeout: '10ms',
      services: [
        { stop: () => new Promise(resolve => setTimeout(resolve, 100)) }
      ]
    })
    await expect(close()).rejects.toThrow(
      'Timeout reached while stopping the server (10ms)'
    )
    await expect(serve(new Hono(), { closeTimeout: 'soon' })).rejects.toThrow(
      `Invalid duration: 'soon'.`
    )
  })

  it('closes and exits on SIGTERM', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined!)
    const onClose = vi.fn()
    const listeners = process.listenerCount('SIGTERM')
    const { server } = await serve(new Hono(), {
      services: [{ stop: onClose }]
    })
    expect(process.listenerCount('SIGTERM')).toBe(listeners + 1)
    process.emit('SIGTERM')
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))
    expect(server.listening).toBe(false)
    expect(onClose).toHaveBeenCalledOnce()
    expect(process.listenerCount('SIGTERM')).toBe(listeners)
    exit.mockRestore()
  })
})

describe('forwarded()', () => {
  it('passes the public URL, the body and the client address on Node', async () => {
    await withServer(echo(true), async url => {
      const response = await fetch(`${url}/api/items?a=1`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'text/plain' },
        body: 'Body'
      })
      expect(await response.json()).toEqual({
        url: 'https://shop.test/api/items?a=1',
        body: 'Body',
        address: '10.0.0.1'
      })
    })
  })

  it('counts the hops of all headers from the right', async () => {
    await withServer(echo(1), async url => {
      const response = await fetch(url, { headers })
      expect(await response.json()).toMatchObject({
        url: 'https://shop.test/',
        address: '10.0.0.1'
      })
    })
    await withServer(echo(2), async url => {
      const response = await fetch(url, { headers })
      expect(await response.json()).toMatchObject({
        url: 'http://spoofed.test/',
        address: '203.0.113.7'
      })
    })
  })

  it('takes the leftmost value with more hops than values', async () => {
    await withServer(echo(3), async url => {
      const response = await fetch(url, { headers })
      expect(await response.json()).toMatchObject({
        url: 'http://spoofed.test/',
        address: '203.0.113.7'
      })
    })
  })

  it('takes the value of a proxy that replaces the header', async () => {
    await withServer(echo(2), async url => {
      const response = await fetch(url, {
        headers: { 'X-Forwarded-Host': 'shop.test' }
      })
      expect((await response.json()).url).toContain('//shop.test')
    })
  })

  it('keeps the URL and the socket address without the headers', async () => {
    await withServer(echo(true), async url => {
      const response = await fetch(`${url}/a?b=1`)
      expect(await response.json()).toEqual({
        url: `${url}/a?b=1`,
        body: '',
        address: '127.0.0.1'
      })
    })
  })

  it('ignores the headers with `false`', async () => {
    await withServer(echo(false), async url => {
      const response = await fetch(`${url}/a`, { headers })
      expect(await response.json()).toMatchObject({
        url: `${url}/a`,
        address: '127.0.0.1'
      })
    })
  })

  it('keeps the port of the forwarded host', async () => {
    const response = await echo(true).request('http://backend:4040/', {
      headers: { 'X-Forwarded-Host': 'shop.test:8443' }
    })
    expect((await response.json()).url).toBe('http://shop.test:8443/')
  })

  it('ignores protocols other than HTTP, and hosts with more than a port', async () => {
    for (const forwarded of [
      { 'X-Forwarded-Proto': 'javascript' },
      { 'X-Forwarded-Host': 'evil.test/path?' },
      { 'X-Forwarded-Host': 'user@evil.test' },
      { 'X-Forwarded-Host': 'evil.test#' }
    ]) {
      const response = await echo(true).request('http://backend:4040/a?b=1', {
        headers: forwarded
      })
      expect((await response.json()).url).toBe('http://backend:4040/a?b=1')
    }
  })

  it(`gives Dito APIs and Hono's CSRF check the public URL`, async () => {
    const api = createApi({
      controllers: [
        {
          path: 'items',
          actions: {
            post: {
              authorize: true,
              handler: ({ c }) => ({
                url: c.req.url,
                address: getClientAddress(c)
              })
            }
          }
        }
      ]
    })
    const app = new Hono()
    app.use(forwarded(true), csrf())
    app.route('/api', api)
    await withServer(app, async url => {
      const response = await fetch(`${url}/api/items`, {
        method: 'POST',
        headers: {
          ...headers,
          'Origin': 'https://shop.test',
          'Content-Type': 'application/json'
        },
        body: '{}'
      })
      expect(await response.json()).toEqual({
        url: 'https://shop.test/api/items',
        address: '10.0.0.1'
      })
      const other = await fetch(`${url}/api/items`, {
        method: 'POST',
        headers: {
          ...headers,
          'Origin': 'https://evil.test',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'a=1'
      })
      expect(other.status).toBe(403)
    })
  })
})

describe('serve()', () => {
  it('stops the started services in reverse when a start fails', async () => {
    const log: string[] = []
    const service = (name: string) => ({
      start: () => void log.push(`${name} start`),
      stop: () => void log.push(`${name} stop`)
    })
    const failing = {
      start: () => Promise.reject(new Error('Failed')),
      stop: () => void log.push('failing stop')
    }
    await expect(
      serve(new Hono(), {
        host: '127.0.0.1',
        services: [
          service('first'),
          service('second'),
          failing,
          service('last')
        ]
      })
    ).rejects.toThrow('Failed')
    expect(log).toEqual([
      'first start',
      'second start',
      'second stop',
      'first stop'
    ])
  })

  it('stops the services when the port is taken', async () => {
    const app = new Hono()
    await withServer(app, async url => {
      const stop = vi.fn()
      const { port } = new URL(url)
      await expect(
        serve(app, { host: '127.0.0.1', port, services: [{ stop }] })
      ).rejects.toThrow('EADDRINUSE')
      expect(stop).toHaveBeenCalledOnce()
    })
  })
})
