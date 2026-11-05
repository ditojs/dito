import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Kysely } from 'kysely'
import { HttpError, createApi, defineController } from '@ditojs/server'
import * as passwords from './passwords.ts'
import { getPasswordFingerprint } from './sessions.ts'
import { getSession, getSessionUser } from './index.ts'
import {
  createSource,
  createUser,
  secrets,
  setup,
  signCookie,
  type TestUser,
  useTestDatabase
} from './test/helpers.ts'
import { createClient } from '../../../tests/utils/client.ts'

const getDb = useTestDatabase()
let db: Kysely<any>
let ada: TestUser
let bob: TestUser
let admins: ReturnType<typeof createSource>

beforeEach(async () => {
  db = getDb()
  ada = await createUser(1, 'ada', 'secret')
  bob = await createUser(2, 'bob', null)
  admins = createSource('Admin', [ada, bob])
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const expiresIn = (offset: number) =>
  new Date(Date.now() + offset).toISOString()

const sessionIds = async () =>
  (await db.selectFrom('session').select('id').execute()).map(row => row.id)

describe('sessions', () => {
  it('stays ended for a request that loaded it before the logout', async () => {
    let release!: () => void
    const released = new Promise<void>(resolve => (release = resolve))
    let started!: () => void
    const isStarted = new Promise<void>(resolve => (started = resolve))
    const { api, sessions } = setup({ db, source: admins })
    const app = new Hono()
      .use(sessions.middleware)
      .post('/slow', async c => {
        const session = getSession(c)
        started()
        await released
        session.value.confirmedAccess = {
          user: 'Admin-1',
          expires: Date.now() + 1000
        }
        return c.text('done')
      })
    const client = createClient(api.fetch)
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    const slow = createClient(app.fetch)
    slow.jar.set('admin.sess', client.jar.get('admin.sess')!)
    const pending = slow.post('/slow')
    await isStarted
    await client.post('/admins/logout')
    expect(await sessionIds()).toEqual([])
    release()
    const { cookies } = await pending
    expect(await sessionIds()).toEqual([])
    expect(cookies).toEqual([])
  })

  it('reads a stored session', async () => {
    const { api } = setup({ db, source: admins })
    const id = '0b7d4d4e-3f71-4c3e-9c2a-1a2b3c4d5e6f'
    await db
      .insertInto('session')
      .values({
        id,
        value: JSON.stringify({
          passport: {
            user: 'Admin-1',
            passwordFingerprint: getPasswordFingerprint(ada.hash)
          },
          confirmedAccess: { user: 'Admin-1', expires: Date.now() - 1000 }
        }),
        expires_at: expiresIn(60_000)
      })
      .execute()
    const client = createClient(api.fetch)
    client.jar.set(
      'admin.sess',
      await signCookie('admin.sess', id, secrets[0]!)
    )
    const { data, cookies } = await client.get('/admins/self')
    expect(data).toEqual({
      id: 1,
      username: 'ada',
      roles: ['admin'],
      lastLogin: null
    })
    // Reading doesn't write the session.
    expect(cookies).toEqual([])
  })

  it('ignores expired, unknown and wrongly signed sessions', async () => {
    const { api } = setup({ db, source: admins })
    const passport = {
      user: 'Admin-1',
      passwordFingerprint: getPasswordFingerprint(ada.hash)
    }
    await db
      .insertInto('session')
      .values(
        [
          { id: 'expired', expires_at: expiresIn(-1) },
          { id: 'endless', expires_at: null },
          { id: 'valid', expires_at: expiresIn(60_000) }
        ].map(row => ({ ...row, value: JSON.stringify({ passport }) }))
      )
      .execute()
    const isAuthenticated = async (id: string, secret = secrets[0]!) => {
      const client = createClient(api.fetch)
      client.jar.set('admin.sess', await signCookie('admin.sess', id, secret))
      return (await client.get('/admins/self')).data !== null
    }
    expect(await isAuthenticated('valid')).toBe(true)
    expect(await isAuthenticated('expired')).toBe(false)
    expect(await isAuthenticated('endless')).toBe(false)
    expect(await isAuthenticated('unknown')).toBe(false)
    expect(await isAuthenticated('valid', 'other secret')).toBe(false)
    // A session from before password fingerprints:
    await db
      .updateTable('session')
      .set({ value: JSON.stringify({ passport: { user: 'Admin-1' } }) })
      .execute()
    expect(await isAuthenticated('valid')).toBe(false)
  })

  it('logs in with a password and regenerates the session id', async () => {
    const { api } = setup({ db, source: admins })
    const client = createClient(api.fetch)
    // A session from before the login, as an attacker might plant it:
    client.jar.set(
      'admin.sess',
      await signCookie('admin.sess', 'planted', secrets[0]!)
    )
    await db
      .insertInto('session')
      .values({
        id: 'planted',
        value: '{"cart":1}',
        expires_at: expiresIn(60_000)
      })
      .execute()
    const response = await client.post('/admins/login', {
      username: 'ada',
      password: 'secret'
    })
    expect(response.status).toBe(200)
    expect(response.data).toEqual({
      user: {
        id: 1,
        username: 'ada',
        roles: ['admin'],
        lastLogin: expect.any(String)
      }
    })
    const [id] = await sessionIds()
    expect(id).toMatch(/^[\da-f-]{36}$/)
    expect(client.jar.get('admin.sess')).toMatch(new RegExp(`^${id}\\.`))
    expect(response.cookies).toEqual([
      expect.stringMatching(
        /; Path=\/; Expires=.+; HttpOnly; Secure; SameSite=Lax$/
      )
    ])
    const row = await db
      .selectFrom('session')
      .selectAll()
      .executeTakeFirstOrThrow()
    expect(row.value).toEqual({
      cart: 1,
      passport: {
        user: 'Admin-1',
        passwordFingerprint: getPasswordFingerprint(ada.hash)
      },
      confirmedAccess: { user: 'Admin-1', expires: expect.any(Number) }
    })
    expect(Date.parse(row.expires_at)).toBeGreaterThan(
      Date.now() + 86_400_000 - 10_000
    )
    expect(ada.lastLogin).toBeInstanceOf(Date)
    expect((await client.get('/admins/self')).data.id).toBe(1)
  })

  it('answers wrong logins', async () => {
    const { api } = setup({ db, source: admins })
    const client = createClient(api.fetch)
    expect(
      await client.post('/admins/login', { username: 'ada', password: 'x' })
    ).toMatchObject({
      status: 401,
      data: { message: 'Password or username is incorrect' }
    })
    expect(
      await client.post('/admins/login', { username: 'ada' })
    ).toMatchObject(
      { status: 400, data: { message: 'Missing credentials' } }
    )
    // Users without a password can't log in:
    expect(
      (await client.post('/admins/login', { username: 'bob', password: '' }))
        .status
    ).toBe(400)
    expect(
      (await client.post('/admins/login', { username: 'bob', password: 'x' }))
        .status
    ).toBe(401)
    expect(
      (await client.post('/admins/login', { username: ['ada'], password: 'x' }))
        .status
    ).toBe(401)
    expect(await sessionIds()).toEqual([])
  })

  it('compares unknown users against a dummy hash', async () => {
    const { api } = setup({ db, source: admins })
    const compare = vi.spyOn(bcrypt, 'compare')
    const client = createClient(api.fetch)
    const response = await client.post('/admins/login', {
      username: 'nobody',
      password: 'secret'
    })
    expect(response.status).toBe(401)
    expect(response.data.message).toBe('Password or username is incorrect')
    await client.post('/admins/login', { username: 'bob', password: 'secret' })
    expect(compare).toHaveBeenCalledTimes(2)
    for (const [password, hash] of compare.mock.calls) {
      expect(password).toBe('secret')
      expect(hash).toMatch(/^\$2b\$10\$/)
    }
    expect(await passwords.verifyPassword(1234, ada.hash)).toBe(false)
  })

  it('logs out and clears the session', async () => {
    const { api } = setup({ db, source: admins })
    const client = createClient(api.fetch)
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    expect((await client.post('/admins/logout')).status).toBe(204)
    expect(client.jar.size).toBe(0)
    expect(await sessionIds()).toEqual([])
    expect((await client.post('/admins/logout')).status).toBe(204)
    expect((await client.get('/admins/self')).data).toBe(null)
  })

  it('ends other sessions when the password changes', async () => {
    const { api } = setup({ db, source: admins })
    const first = createClient(api.fetch)
    const second = createClient(api.fetch)
    for (const client of [first, second]) {
      await client.post('/admins/login', {
        username: 'ada',
        password: 'secret'
      })
    }
    expect(
      (await first.post('/admins/password', { password: 'new secret' })).status
    ).toBe(204)
    expect((await first.get('/admins/self')).data).not.toBe(null)
    expect((await second.get('/admins/self')).data).toBe(null)
    expect(
      (
        await second.post('/admins/login', {
          username: 'ada',
          password: 'new secret'
        })
      ).status
    ).toBe(200)
  })

  it('saved sessions sign with the first secret', async () => {
    const { api } = setup({
      db,
      source: admins,
      secrets: [...secrets, 'older secret']
    })
    const client = createClient(api.fetch)
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    const [id] = await sessionIds()
    expect(client.jar.get('admin.sess')).toBe(
      await signCookie('admin.sess', id, secrets[0]!)
    )
  })

  it('needs secrets', () => {
    expect(() => setup({ db, source: admins, secrets: [] })).toThrow(
      'Unable to sign cookies without secrets.'
    )
  })

  it('confirms the access, and asks for it after it expired', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { api } = setup({ db, source: admins, reconfirmAfter: 60_000 })
    const client = createClient(api.fetch)
    const body = { password: 'new secret' }
    expect(await client.post('/admins/password', body)).toMatchObject({
      status: 401,
      data: { message: 'Unauthorized Access' }
    })
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    vi.advanceTimersByTime(61_000)
    const response = await client.post('/admins/password', body)
    expect(response).toMatchObject({
      status: 403,
      data: {
        status: 403,
        message: 'Confirmation required',
        confirmationRequired: true
      }
    })
    expect(
      await client.post('/admins/confirm-access', { password: 'wrong' })
    ).toMatchObject({ status: 401, data: { message: 'Password is incorrect' } })
    expect(
      await client.post('/admins/confirm-access', { password: 'secret' })
    ).toMatchObject({ status: 204, data: undefined })
    expect((await client.post('/admins/password', body)).status).toBe(204)
  })

  it('checks new passwords', async () => {
    const { api } = setup({ db, source: admins })
    const client = createClient(api.fetch)
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    const getErrors = async (password: unknown) =>
      (await client.post('/admins/password', { password })).data.errors
    expect(await getErrors('')).toEqual({
      password: [
        {
          message: 'The password needs at least 8 characters.',
          keyword: 'too_small'
        }
      ]
    })
    expect(await getErrors('1234567')).toMatchObject({
      password: [{ keyword: 'too_small' }]
    })
    expect(await getErrors(undefined)).toEqual({
      password: [
        { message: 'The password is required.', keyword: 'invalid_type' }
      ]
    })
    expect(
      (await client.post('/admins/password', { password: '12345678' })).status
    ).toBe(204)
    // An app's own schema:
    const custom = createClient(
      setup({ db, source: admins, password: z.string().min(12) }).api.fetch
    )
    await custom.post('/admins/login', {
      username: 'ada',
      password: '12345678'
    })
    expect(
      (await custom.post('/admins/password', { password: '12345678' })).status
    ).toBe(400)
    expect(
      (await custom.post('/admins/password', { password: '123456789012' }))
        .status
    ).toBe(204)
  })

  it('serves self', async () => {
    const { api } = setup({ db, source: admins })
    const client = createClient(api.fetch)
    expect((await client.get('/admins/self')).data).toBe(null)
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    expect((await client.get('/admins/self')).data).toEqual({
      id: 1,
      username: 'ada',
      roles: ['admin'],
      lastLogin: expect.any(String)
    })
  })

  it('keeps the users of other sources out', async () => {
    const carl = await createUser(1, 'carl', 'secret', [])
    const customers = createSource('Customer', [carl])
    const admin = setup({ db, source: admins })
    const client = createClient(admin.api.fetch)
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    // The same cookie and store, routed for customers:
    const customer = setup({ db, source: customers })
    const other = createClient(customer.api.fetch)
    for (const [key, value] of client.jar) other.jar.set(key, value)
    expect((await other.get('/admins/self')).data).toBe(null)
    expect(
      (await other.post('/admins/password', { password: 'new secret' })).status
    ).toBe(
      401
    )
    // The session of the admin stays:
    expect((await client.get('/admins/self')).data).not.toBe(null)
    // Through `getUser` of `createApi()`:
    const apis = [admins, customers].map(source =>
      new Hono().use(admin.sessions.middleware).route(
        '/',
        createApi({
          getUser: ({ c }) => getSessionUser(c, source),
          controllers: [
            defineController({
              path: 'me',
              actions: { get: ({ user }) => user }
            })
          ]
        })
      )
    )
    const cookie = [...client.jar].map(([k, v]) => `${k}=${v}`).join('; ')
    const get = async (api: (typeof apis)[number]) =>
      (
        await api.fetch(
          new Request('https://example.com/me', { headers: { Cookie: cookie } })
        )
      ).json()
    expect(await get(apis[0]!)).toEqual({ id: 1, roles: ['admin'] })
    expect(await get(apis[1]!)).toBe(null)
  })

  it('saves the session and sets its cookie on errors', async () => {
    const { sessions } = setup({ db, source: admins })
    const app = new Hono()
      .use(sessions.middleware)
      .get('/visit', c => {
        getSession(c).value.visits = 1
        return c.json(c.var.session.value)
      })
      .route(
        '/',
        createApi({
          controllers: [
            defineController({
              path: 'fail',
              authorize: true,
              actions: {
                post: ({ c }) => {
                  getSession(c).value.failures = 1
                  throw new HttpError(400)
                }
              }
            })
          ]
        })
      )
    const client = createClient(app.fetch)
    expect((await client.get('/visit')).data).toEqual({ visits: 1 })
    // The changed session is saved, and its cookie sent again with the new
    // expiry, as on success.
    const response = await client.post('/fail')
    expect(response.status).toBe(400)
    expect(response.cookies).toHaveLength(1)
    const other = createClient(app.fetch)
    const failed = await other.post('/fail')
    expect(failed.status).toBe(400)
    expect(failed.cookies).toHaveLength(1)
    const values = (await db.selectFrom('session').select('value').execute())
      .map(row => row.value)
    expect(values).toMatchObject([
      { visits: 1, failures: 1 },
      { failures: 1 }
    ])
  })

  it('reads signed cookies of all secrets', async () => {
    const { sessions } = setup({ db, source: admins, secrets: ['new', 'old'] })
    const app = new Hono().get('/', async c =>
      c.json(await sessions.readSignedCookie(c, 'flag'))
    )
    const read = async (cookie?: string) =>
      (
        await app.fetch(
          new Request('https://example.com', {
            headers: cookie ? { Cookie: `flag=${cookie}` } : {}
          })
        )
      ).json()
    expect(await read(await signCookie('flag', 'true', 'old'))).toBe('true')
    expect(await read(await signCookie('flag', 'true', 'new'))).toBe('true')
    expect(await read(await signCookie('flag', 'true', 'other'))).toBe(null)
    expect(await read('true')).toBe(null)
    expect(await read()).toBe(null)
  })

  it('deletes expired sessions', async () => {
    await db
      .insertInto('session')
      .values([
        { id: 'old', value: '{}', expires_at: expiresIn(-1) },
        { id: 'new', value: '{}', expires_at: expiresIn(60_000) },
        { id: 'endless', value: '{}', expires_at: null }
      ])
      .execute()
    await setup({ db, source: admins }).sessions.deleteExpired()
    expect((await sessionIds()).sort()).toEqual(['endless', 'new'])
  })
})
