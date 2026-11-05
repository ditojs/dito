import type { Kysely } from 'kysely'
import type { Mock } from 'vitest'
import { createPasswordReset } from '../src/index.ts'
import {
  createSource,
  createUser,
  secrets,
  setup,
  type TestUser,
  useTestDatabase
} from './helpers.ts'
import { createClient } from '../../../tests/utils/client.ts'

const getDb = useTestDatabase()
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
  db = getDb()
  ada = await createUser(1, 'ada@example.com', 'secret', [])
  customers = createSource('Customer', [ada])
  send = vi.fn()
  onError = vi.fn()
  const { api } = setup({
    db,
    cookieName: 'customer.sess',
    source: customers,
    features: {
      passwordReset: createPasswordReset({
        secrets,
        confirmUrl: 'https://example.com/admin/#password-reset={token}',
        send,
        onError
      })
    }
  })
  client = createClient(api.fetch)
  other = createClient(api.fetch)
})

afterEach(() => {
  vi.useRealTimers()
})

const request = (username: unknown) =>
  client.post('/admins/password-reset', { username })

describe('passwordReset()', () => {
  it('needs a placeholder for the token', () => {
    expect(() =>
      createPasswordReset({ secrets, confirmUrl: 'https://example.com', send })
    ).toThrow(`'confirmUrl' needs '{token}'`)
    expect(() =>
      createPasswordReset({ secrets: [], confirmUrl: '{token}', send })
    ).toThrow('Unable to sign tokens without secrets.')
  })

  it('answers the same for unknown accounts', async () => {
    expect(await request('ada@example.com')).toEqual(
      await request('nobody@example.com')
    )
    expect((await request('nobody@example.com')).status).toBe(204)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![1]).toBe(ada)
    expect(await request(undefined)).toMatchObject({
      status: 400,
      data: {
        errors: { username: [{ message: 'The username is required.' }] }
      }
    })
    expect((await request('')).data.errors).toEqual({
      username: [
        { message: 'The username is required.', keyword: 'too_small' }
      ]
    })
  })

  it('reports failures to send without changing the answer', async () => {
    const error = new Error('No mail server')
    send.mockRejectedValueOnce(error)
    expect((await request('ada@example.com')).status).toBe(204)
    await vi.waitFor(() => expect(onError).toHaveBeenCalled())
    expect(onError.mock.calls[0][1]).toBe(error)
  })

  it('sends one link per minute and user', async () => {
    await request('ada@example.com')
    vi.advanceTimersByTime(59_000)
    expect((await request('ada@example.com')).status).toBe(204)
    expect(send).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    await request('ada@example.com')
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('sets the password with a valid token, once', async () => {
    expect(
      (
        await other.post('/admins/login', {
          username: 'ada@example.com',
          password: 'secret'
        })
      ).status
    ).toBe(200)
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
      data: { errors: { password: [{ keyword: 'too_small' }] } }
    })
    expect(
      (
        await client.post('/admins/password-reset-confirm', {
          token,
          password: 'short'
        })
      ).status
    ).toBe(400)
    expect(
      await client.post('/admins/password-reset-confirm', {
        token,
        password: 'new secret'
      })
    ).toMatchObject({ status: 204, data: undefined })
    // The other session and the link end with the new hash:
    expect((await other.get('/admins/self')).data).toBe(null)
    expect(
      await client.post('/admins/password-reset-confirm', {
        token,
        password: 'other secret'
      })
    ).toMatchObject({
      status: 400,
      data: { message: 'Invalid or expired token' }
    })
    expect(
      (
        await client.post('/admins/login', {
          username: 'ada@example.com',
          password: 'new secret'
        })
      ).status
    ).toBe(200)
  })

  it('rejects expired and tampered tokens', async () => {
    await request('ada@example.com')
    const token = getToken()
    const [id, time, signature] = token.split('.')
    const confirm = (token: string) =>
      client.post('/admins/password-reset-confirm', {
        token,
        password: 'new secret'
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

  it('signs the values of the user with the first secret', () => {
    const feature = createPasswordReset({
      secrets: [...secrets, 'older secret'],
      confirmUrl: '{token}',
      send
    })
    vi.setSystemTime(Date.UTC(2026, 0, 1))
    // HMAC-SHA256 over `["Customer-1",time,hash,lastLogin,username]`:
    const user = { ...ada, hash: 'hash', lastLogin: new Date() }
    feature.sendLink({} as any, customers, user)
    expect(send.mock.calls[0]![2]).toBe(
      'MQ.mjuohs00.K7uAn90VappUNf7Z2Ago4lWBx3WDX6AYby1XYSmjCr8'
    )
  })

  it('accepts tokens of older secrets', async () => {
    const older = createPasswordReset({
      secrets: ['older'],
      confirmUrl: '{token}',
      send
    })
    const rotated = createPasswordReset({
      secrets: ['newer', 'older'],
      confirmUrl: '{token}',
      send
    })
    older.sendLink({} as any, customers, ada)
    const token = send.mock.calls[0]![2]
    expect(await rotated.findUser({} as any, customers, token)).toBe(ada)
    expect(
      await createPasswordReset({ secrets, confirmUrl: '{token}', send })
        .findUser({} as any, customers, token)
    ).toBe(null)
  })
})
