import { Hono } from 'hono'
import Cookies from 'cookies'
import Keygrip from 'keygrip'
import { createKeygrip, koaCookies } from '../src/index.ts'

// Writes cookies with the `cookies` package, as Koa does, and returns the
// `Cookie` header that a browser sends back.
function writeWithKoa(keys: string[], name: string, value: string) {
  const headers: Record<string, string[]> = {}
  const req = { headers: {}, connection: { encrypted: true } } as any
  const res = {
    getHeader: (key: string) => headers[key.toLowerCase()],
    setHeader: (key: string, value: string[]) => {
      headers[key.toLowerCase()] = value
    }
  } as any
  new Cookies(req, res, { keys }).set(name, value, { signed: true })
  return headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ')
}

function readWithKoa(keys: string[], header: string, name: string) {
  const req = { headers: { cookie: header }, connection: {} } as any
  const res = { getHeader: () => [], setHeader: () => {} } as any
  return new Cookies(req, res, { keys }).get(name, { signed: true })
}

function createApp(keys: string[]) {
  const cookies = koaCookies(keys)
  const app = new Hono()
  app.get('/read', c => c.json(cookies.get(c, 'admin.sess')))
  app.get('/write', c => {
    cookies.set(c, 'admin.sess', c.req.query('value')!, {
      sameSite: 'lax',
      secure: true,
      expires: new Date(Date.UTC(2030, 0, 1))
    })
    return c.body(null, 204)
  })
  app.get('/remove', c => {
    cookies.set(c, 'admin.sess', null, { sameSite: 'lax' })
    return c.body(null, 204)
  })
  return app
}

const read = async (app: Hono, cookie: string) =>
  (await app.request('/read', { headers: { Cookie: cookie } })).json()

describe('createKeygrip()', () => {
  it('signs as Keygrip does', () => {
    const data = 'admin.sess=6f1c2a3e-1111-4222-8333-944455556666'
    // Computed with `keygrip` 1.1.0.
    expect(createKeygrip(['old key', 'secret sauce']).sign(data)).toBe(
      '95JL-KuZ1lR2DNVDxyI7c_obhNk'
    )
    expect(createKeygrip(['secret sauce'], 'sha256').sign('data')).toBe(
      'VaAb-ND8BQKre6pQSYfo7XsEqP-v_Nq9YPQWJRC-uhY'
    )
    for (const algorithm of ['sha1', 'sha256']) {
      const keygrip = new Keygrip(['a', 'b'], algorithm)
      expect(createKeygrip(['a', 'b'], algorithm).sign(data)).toBe(
        keygrip.sign(data)
      )
    }
  })

  it('verifies with all keys and tells which one signed', () => {
    const data = 'admin.sess=1'
    const signature = new Keygrip(['old']).sign(data)
    const keygrip = createKeygrip(['new', 'old'])
    expect(keygrip.index(data, signature)).toBe(1)
    expect(keygrip.verify(data, signature)).toBe(true)
    expect(keygrip.index('admin.sess=2', signature)).toBe(-1)
    expect(keygrip.index(data, `${signature}x`)).toBe(-1)
    expect(keygrip.index(data, '')).toBe(-1)
  })

  it('needs keys', () => {
    expect(() => createKeygrip([])).toThrow('Unable to sign without keys.')
  })
})

describe('koaCookies()', () => {
  const id = '6f1c2a3e-1111-4222-8333-944455556666'

  it('reads the signed cookies of Koa', async () => {
    const header = writeWithKoa(['secret sauce'], 'admin.sess', id)
    expect(await read(createApp(['secret sauce']), header)).toEqual({
      value: id,
      index: 0
    })
  })

  it('writes cookies that Koa reads', async () => {
    const response = await createApp(['secret sauce']).request(
      `/write?value=${id}`
    )
    const cookies = response.headers.getSetCookie()
    expect(cookies).toEqual([
      `admin.sess=${id}; path=/; expires=Tue, 01 Jan 2030 00:00:00 GMT; ` +
      'samesite=lax; secure; httponly',
      `admin.sess.sig=${
        new Keygrip(['secret sauce']).sign(`admin.sess=${id}`)
      }` +
      '; path=/; expires=Tue, 01 Jan 2030 00:00:00 GMT; samesite=lax; ' +
        'secure; httponly'
    ])
    const header = cookies.map(cookie => cookie.split(';')[0]).join('; ')
    expect(readWithKoa(['secret sauce'], header, 'admin.sess')).toBe(id)
  })

  it('accepts cookies of older keys', async () => {
    const header = writeWithKoa(['old key'], 'admin.sess', id)
    expect(await read(createApp(['new key', 'old key']), header)).toEqual({
      value: id,
      index: 1
    })
    expect(await read(createApp(['new key']), header)).toBe(null)
  })

  it('rejects tampered cookies', async () => {
    const app = createApp(['secret sauce'])
    const header = writeWithKoa(['secret sauce'], 'admin.sess', id)
    const other = header.replace(id, id.replace('6', '7'))
    expect(await read(app, other)).toBe(null)
    expect(await read(app, header.replace(/sig=./, 'sig=x'))).toBe(null)
    expect(await read(app, header.split('; ')[0])).toBe(null)
    // A signature of another cookie name:
    const renamed = writeWithKoa(['secret sauce'], 'customer.sess', id)
    expect(await read(app, renamed.replaceAll('customer', 'admin'))).toBe(
      null
    )
  })

  it('removes both cookies', async () => {
    const response = await createApp(['secret sauce']).request('/remove')
    const cookies = response.headers.getSetCookie()
    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toBe(
      'admin.sess=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; ' +
      'samesite=lax; httponly'
    )
    expect(cookies[1]).toMatch(/^admin\.sess\.sig=[\w-]+; path=\/; expires=Thu/)
  })
})
