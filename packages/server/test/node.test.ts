import type { AddressInfo } from 'node:net'
import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { createApi, hostMiddleware } from '../src/index.ts'
import { forwarded, getClientAddress, serve } from '../src/node.ts'

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
  'X-Forwarded-Proto': 'https, http',
  'X-Forwarded-Host': 'shop.test, backend',
  'X-Forwarded-For': '203.0.113.7, 10.0.0.1'
}

describe('hostMiddleware() on Node', () => {
  // Answers `/secret` with 401, without reading the body.
  const host = () => {
    const app = new Hono()
    app.use(...hostMiddleware())
    app.post('/secret', c => c.text('Unauthorized', 401))
    app.get('/', c => c.text('ok'))
    return app
  }

  // Keep-alive connections fail on the next request when the server resets
  // them, which takes a few rounds to show.
  async function expectOpenConnections(size: number, status: number) {
    await withServer(host(), async url => {
      for (let i = 0; i < 30; i++) {
        const response = await fetch(`${url}/secret`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
})

describe('serve()', () => {
  it('serves the app until `close()`, and then runs `onClose`', async () => {
    const app = new Hono()
    app.get('/', c => c.text('Hello'))
    const onClose = vi.fn()
    const { server, close } = await serve(app, { host: '127.0.0.1', onClose })
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
      onClose: () => new Promise(resolve => setTimeout(resolve, 100))
    })
    await expect(close()).rejects.toThrow(
      'Timeout reached while stopping the server (10ms)'
    )
  })

  it('closes and exits on SIGTERM', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined!)
    const onClose = vi.fn()
    const listeners = process.listenerCount('SIGTERM')
    const { server } = await serve(new Hono(), { onClose })
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

  it('counts the hops of `X-Forwarded-For` from the right', async () => {
    await withServer(echo(2), async url => {
      const response = await fetch(url, { headers })
      expect((await response.json()).address).toBe('203.0.113.7')
    })
    await withServer(echo(3), async url => {
      const response = await fetch(url, { headers })
      expect((await response.json()).address).toBe('203.0.113.7')
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
