import type { Kysely } from 'kysely'
import type { Mock } from 'vitest'
import { passwordReset } from '../src/index.ts'
import {
  createClient,
  createDatabase,
  createSource,
  createUser,
  keys,
  setup,
  type TestUser
} from './helpers.ts'

let db: Kysely<any>
let ada: TestUser
let customers: ReturnType<typeof createSource>
let send: Mock<(c: unknown, user: unknown, url: string) => unknown>
let onError: Mock<(c: unknown, error: unknown) => void>
let client: ReturnType<typeof createClient>
let other: ReturnType<typeof createClient>

const getToken = () => {
  const url: string = send.mock.calls.at(-1)![2]
  return url.slice(url.indexOf('#password-reset=') + 16)
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  db = await createDatabase()
  ada = await createUser(1, 'ada@example.com', 'secret', [])
  customers = createSource('Customer', [ada], 'email')
  send = vi.fn()
  onError = vi.fn()
  const { app } = setup({
    db,
    name: 'customer.sess',
    source: customers,
    features: {
      passwordReset: passwordReset({
        keys,
        confirmUrl: 'https://example.com/admin/#password-reset={token}',
        send,
        onError
      })
    }
  })
  client = createClient(app)
  other = createClient(app)
})

afterEach(() => {
  vi.useRealTimers()
})

const request = (email: unknown) =>
  client.post('/admins/password-reset', { email })

describe('passwordReset()', () => {
  it('needs a placeholder for the token', () => {
    expect(() =>
      passwordReset({ keys, confirmUrl: 'https://example.com', send })
    ).toThrow(`'confirmUrl' needs '{token}'`)
    expect(() =>
      passwordReset({ keys: [], confirmUrl: '{token}', send })
    ).toThrow('Unable to sign without keys.')
  })

  it('answers the same for unknown accounts', async () => {
    expect(await request('ada@example.com')).toEqual(
      await request('nobody@example.com')
    )
    expect((await request('nobody@example.com')).data).toEqual({
      success: true
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][1]).toBe(ada)
    expect(await request(undefined)).toMatchObject({
      status: 400,
      data: { message: `Missing 'email'` }
    })
    expect((await request(['x'])).data.message).toBe(`Invalid 'email'`)
  })

  it('reports failures to send without changing the answer', async () => {
    const error = new Error('No mail server')
    send.mockRejectedValueOnce(error)
    expect((await request('ada@example.com')).data).toEqual({ success: true })
    await vi.waitFor(() => expect(onError).toHaveBeenCalled())
    expect(onError.mock.calls[0][1]).toBe(error)
  })

  it('sets the password with a valid token, once', async () => {
    expect(
      (
        await other.post('/admins/login', {
          email: 'ada@example.com',
          password: 'secret'
        })
      ).data.success
    ).toBe(true)
    await request('ada@example.com')
    const token = getToken()
    expect(token).toMatch(/^[\w-]+\.[\da-z]+\.[\w-]+$/)
    expect(
      await client.post('/admins/password-reset-confirm', {
        token,
        password: ''
      })
    ).toMatchObject({
      status: 400,
      data: { errors: { '/password': [{ keyword: 'required' }] } }
    })
    expect(
      await client.post('/admins/password-reset-confirm', {
        token,
        password: 'new secret'
      })
    ).toMatchObject({ status: 200, data: { success: true } })
    // The other session and the link end with the new hash:
    expect((await other.get('/admins/session')).data.authenticated).toBe(false)
    expect(
      await client.post('/admins/password-reset-confirm', {
        token,
        password: 'other'
      })
    ).toMatchObject({
      status: 400,
      data: { message: 'Invalid or expired token' }
    })
    expect(
      (
        await client.post('/admins/login', {
          email: 'ada@example.com',
          password: 'new secret'
        })
      ).data.success
    ).toBe(true)
  })

  it('rejects expired and tampered tokens', async () => {
    await request('ada@example.com')
    const token = getToken()
    const [id, time, signature] = token.split('.')
    const confirm = (token: string) =>
      client.post('/admins/password-reset-confirm', {
        token,
        password: 'new'
      })
    for (const tampered of [
      `${Buffer.from('2').toString('base64url')}.${time}.${signature}`,
      `${id}.${(parseInt(time, 36) + 1).toString(36)}.${signature}`,
      `${id}.${time}.${signature.slice(0, -1)}`,
      `.${time}.${signature}`,
      'garbage'
    ]) {
      expect((await confirm(tampered)).status).toBe(400)
    }
    expect((await confirm(undefined as any)).status).toBe(400)
    vi.advanceTimersByTime(60 * 60 * 1000)
    expect((await confirm(token)).data.message).toBe('Invalid or expired token')
    expect(ada.hash).not.toBe(null)
  })

  it('creates the tokens of Dito 6', () => {
    const feature = passwordReset({ keys, confirmUrl: '{token}', send })
    const time = Date.UTC(2026, 0, 1)
    // Computed with `keygrip` 1.1.0 and SHA-256 over
    // `["Customer-1",time,hash,lastLogin,email]`, as Dito 6 signs:
    const user = { ...ada, hash: 'hash', lastLogin: new Date(time) }
    expect(feature.createToken(customers, user, time)).toBe(
      'MQ.mjuohs00.K7uAn90VappUNf7Z2Ago4lWBx3WDX6AYby1XYSmjCr8'
    )
  })
})
