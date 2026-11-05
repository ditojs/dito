import { Hono } from 'hono'
import { createErrorHandler, hostMiddleware } from './index.ts'

describe('hostMiddleware()', () => {
  const host = (...args: Parameters<typeof hostMiddleware>) => {
    const app = new Hono()
    app.onError(createErrorHandler())
    app.use(...hostMiddleware(...args))
    app.all('/', async c => c.text((await c.req.text()) || 'text'))
    return app
  }

  const post = (app: Hono, headers: Record<string, string>, body = 'body') =>
    app.request('http://localhost/', { method: 'POST', headers, body })

  it('checks `Origin` only where a request sends it', async () => {
    const form = { 'Content-Type': 'application/x-www-form-urlencoded' }
    const app = host()
    expect((await post(app, form)).status).toBe(200)
    const denied = await post(app, { ...form, Origin: 'https://evil.test' })
    expect(denied.status).toBe(403)
    expect((await denied.json()).status).toBe(403)
    expect(denied.headers.has('X-Content-Type-Options')).toBe(true)
    const same = await post(app, { ...form, Origin: 'http://localhost' })
    expect(same.status).toBe(200)
    const allowed = host({ csrf: { origin: 'https://admin.test' } })
    expect(
      (await post(allowed, { ...form, Origin: 'https://admin.test' })).status
    ).toBe(200)
    expect(
      (
        await post(host({ csrf: false }), {
          ...form,
          Origin: 'https://evil.test'
        })
      ).status
    ).toBe(200)
  })

  it('sets the secure headers, unless turned off', async () => {
    const on = await host().request('/')
    const off = await host({ secureHeaders: false }).request('/')
    expect(on.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(off.headers.has('X-Content-Type-Options')).toBe(false)
  })

  it('limits bodies to 1 MB, except multipart bodies', async () => {
    const large = 'x'.repeat(1024 * 1024 + 1)
    const plain = { 'Content-Type': 'text/plain' }
    const multipart = { 'Content-Type': 'multipart/form-data; boundary=x' }
    const app = host()
    const refused = await post(app, plain, large)
    expect(refused.status).toBe(413)
    expect((await refused.json()).status).toBe(413)
    expect((await post(app, multipart, large)).status).toBe(200)
    expect((await post(app, plain, 'x'.repeat(1024))).status).toBe(200)
    const small = host({ bodyLimit: { maxSize: 2 } })
    expect((await post(small, plain, 'abc')).status).toBe(413)
    const open = host({ bodyLimit: false })
    expect((await post(open, plain, large)).status).toBe(200)
  })

  it('takes sizes with units as the body limit', async () => {
    const plain = { 'Content-Type': 'text/plain' }
    const app = host({ bodyLimit: { maxSize: '1kb' } })
    expect((await post(app, plain, 'x'.repeat(1000))).status).toBe(200)
    expect((await post(app, plain, 'x'.repeat(1001))).status).toBe(413)
    expect(() => hostMiddleware({ bodyLimit: { maxSize: 'large' } })).toThrow(
      `Invalid file size: 'large'`
    )
  })

  it('adds `cors` and `etag` when asked', async () => {
    const off = await host().request('/')
    expect(off.headers.has('ETag')).toBe(false)
    expect(off.headers.has('Access-Control-Allow-Origin')).toBe(false)
    const on = await host({ cors: true, etag: true }).request('/')
    expect(on.headers.has('ETag')).toBe(true)
    expect(on.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const origin = await host({ cors: { origin: 'https://a.test' } }).request(
      '/',
      { headers: { Origin: 'https://a.test' } }
    )
    expect(origin.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://a.test'
    )
  })
})
