import { createHash } from 'node:crypto'
import Keygrip from 'keygrip'
import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'
import { createApp, defineController } from '@ditojs/server-next'
import * as passwords from '../src/passwords.ts'
import {
  createSessionStore,
  deleteExpiredSessions,
  sessionUser
} from '../src/index.ts'
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
let bob: TestUser
let admins: ReturnType<typeof createSource>

beforeEach(async () => {
  db = await createDatabase()
  ada = await createUser(1, 'ada', 'secret')
  bob = await createUser(2, 'bob', null)
  admins = createSource('Admin', [ada, bob])
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const sessionIds = async () =>
  (await db.selectFrom('session').select('id').execute()).map(row => row.id)

describe('sessions', () => {
  it('reads a session that Dito 6 wrote', async () => {
    const { app } = setup({ db, source: admins })
    const id = '0b7d4d4e-3f71-4c3e-9c2a-1a2b3c4d5e6f'
    const fingerprint = createHash('sha256')
      .update(ada.hash!)
      .digest('base64url')
    await db
      .insertInto('session')
      .values({
        id,
        value: JSON.stringify({
          passport: { user: 'Admin-1', passwordFingerprint: fingerprint },
          confirmedAccess: { user: 'Admin-1', expires: Date.now() - 1000 },
          _expire: Date.now() + 60_000,
          _maxAge: 86_400_000
        }),
        expires_at: null
      })
      .execute()
    const client = createClient(app)
    client.jar.set('admin.sess', id)
    client.jar.set(
      'admin.sess.sig',
      new Keygrip(keys).sign(`admin.sess=${id}`)
    )
    const { data, cookies } = await client.get('/admins/session')
    expect(data).toEqual({
      authenticated: true,
      user: { id: 1, username: 'ada', roles: ['admin'], lastLogin: null }
    })
    // Reading doesn't write the session.
    expect(cookies).toEqual([])
  })

  it('ignores expired and unknown sessions', async () => {
    const { app } = setup({ db, source: admins })
    const id = 'expired'
    await db
      .insertInto('session')
      .values({
        id,
        value: JSON.stringify({
          passport: { user: 'Admin-1' },
          _expire: Date.now() - 1
        })
      })
      .execute()
    const client = createClient(app)
    client.jar.set('admin.sess', id)
    client.jar.set(
      'admin.sess.sig',
      new Keygrip(keys).sign(`admin.sess=${id}`)
    )
    expect((await client.get('/admins/session')).data.authenticated).toBe(
      false
    )
    client.jar.set('admin.sess', 'unknown')
    client.jar.set(
      'admin.sess.sig',
      new Keygrip(keys).sign('admin.sess=unknown')
    )
    expect((await client.get('/admins/session')).data.authenticated).toBe(
      false
    )
  })

  it('logs in with a password and regenerates the session id', async () => {
    const { app } = setup({ db, source: admins })
    const client = createClient(app)
    // A session from before the login, as an attacker might plant it:
    client.jar.set('admin.sess', 'planted')
    client.jar.set(
      'admin.sess.sig',
      new Keygrip(keys).sign('admin.sess=planted')
    )
    await db
      .insertInto('session')
      .values({ id: 'planted', value: '{"cart":1}' })
      .execute()
    const response = await client.post('/admins/login', {
      username: 'ada',
      password: 'secret'
    })
    expect(response.status).toBe(200)
    expect(response.data).toMatchObject({
      success: true,
      authenticated: true,
      user: { id: 1, username: 'ada' }
    })
    expect(response.data.user.hash).toBeUndefined()
    const id = client.jar.get('admin.sess')
    expect(id).toMatch(/^[\da-f-]{36}$/)
    expect(await sessionIds()).toEqual([id])
    const [cookie] = response.cookies
    expect(cookie).toMatch(
      /; path=\/; expires=.+; samesite=lax; secure; httponly$/
    )
    const row = await db
      .selectFrom('session')
      .selectAll()
      .executeTakeFirstOrThrow()
    const value = JSON.parse(row.value)
    expect(value).toMatchObject({
      cart: 1,
      passport: {
        user: 'Admin-1',
        passwordFingerprint: passwords.getPasswordFingerprint(ada.hash)
      },
      confirmedAccess: { user: 'Admin-1' },
      _maxAge: 86_400_000
    })
    expect(row.expires_at).toBe(new Date(value._expire).toISOString())
    expect(ada.lastLogin).toBeInstanceOf(Date)
    expect((await client.get('/admins/session')).data.user.id).toBe(1)
  })

  it('answers wrong logins as Dito 6 does', async () => {
    const { app } = setup({ db, source: admins })
    const client = createClient(app)
    const failure = { success: false, authenticated: false, user: null }
    expect(
      await client.post('/admins/login', { username: 'ada', password: 'x' })
    ).toMatchObject({
      status: 401,
      data: { ...failure, error: 'Password or username is incorrect' }
    })
    expect(
      await client.post('/admins/login', { username: 'ada' })
    ).toMatchObject(
      { status: 400, data: { ...failure, error: 'Missing credentials' } }
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
    const { app } = setup({ db, source: admins })
    const compare = vi.spyOn(bcrypt, 'compare')
    const client = createClient(app)
    const response = await client.post('/admins/login', {
      username: 'nobody',
      password: 'secret'
    })
    expect(response.status).toBe(401)
    expect(response.data.error).toBe('Password or username is incorrect')
    await client.post('/admins/login', { username: 'bob', password: 'secret' })
    expect(compare).toHaveBeenCalledTimes(2)
    for (const [password, hash] of compare.mock.calls) {
      expect(password).toBe('secret')
      expect(hash).toMatch(/^\$2b\$10\$/)
    }
    expect(await passwords.verifyPassword(1234, ada.hash)).toBe(false)
  })

  it('logs out and clears the session', async () => {
    const { app } = setup({ db, source: admins })
    const client = createClient(app)
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    expect(await client.post('/admins/logout')).toMatchObject({
      status: 200,
      data: { success: true, authenticated: false }
    })
    expect(client.jar.size).toBe(0)
    expect(await sessionIds()).toEqual([])
    expect((await client.post('/admins/logout')).data.success).toBe(false)
    expect((await client.get('/admins/session')).data).toEqual({
      authenticated: false,
      user: null
    })
  })

  it('ends other sessions when the password changes', async () => {
    const { app } = setup({ db, source: admins })
    const first = createClient(app)
    const second = createClient(app)
    for (const client of [first, second]) {
      await client.post('/admins/login', {
        username: 'ada',
        password: 'secret'
      })
    }
    expect(
      await first.post('/admins/password', { password: 'new secret' })
    ).toMatchObject({ status: 200, data: { success: true } })
    expect((await first.get('/admins/session')).data.authenticated).toBe(true)
    expect((await second.get('/admins/session')).data.authenticated).toBe(
      false
    )
    expect(
      (
        await second.post('/admins/login', {
          username: 'ada',
          password: 'new secret'
        })
      ).data.success
    ).toBe(true)
  })

  it('gives sessions without a fingerprint one', async () => {
    const { app } = setup({ db, source: admins })
    const id = 'old'
    await db
      .insertInto('session')
      .values({ id, value: JSON.stringify({ passport: { user: 'Admin-1' } }) })
      .execute()
    const client = createClient(app)
    client.jar.set('admin.sess', id)
    client.jar.set('admin.sess.sig', new Keygrip(keys).sign('admin.sess=old'))
    expect((await client.get('/admins/session')).data.authenticated).toBe(true)
    const row = await db
      .selectFrom('session')
      .select('value')
      .executeTakeFirstOrThrow()
    expect(JSON.parse(row.value).passport.passwordFingerprint).toBe(
      passwords.getPasswordFingerprint(ada.hash)
    )
  })

  it('signs cookies of older keys again', async () => {
    const { app } = setup({ db, source: admins, keys: [...keys, 'older key'] })
    await db
      .insertInto('session')
      .values({ id: 'rotated', value: '{"passport":{"user":"Admin-1"}}' })
      .execute()
    const client = createClient(app)
    client.jar.set('admin.sess', 'rotated')
    client.jar.set(
      'admin.sess.sig',
      new Keygrip(['older key']).sign('admin.sess=rotated')
    )
    const { data, cookies } = await client.get('/admins/session')
    expect(data.authenticated).toBe(true)
    expect(cookies[1]).toContain(
      `admin.sess.sig=${new Keygrip(keys).sign('admin.sess=rotated')};`
    )
  })

  it('confirms the access, and asks for it after it expired', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { app } = setup({ db, source: admins, reconfirmAfter: 60_000 })
    const client = createClient(app)
    expect(
      await client.post('/admins/password', { password: 'x' })
    ).toMatchObject({ status: 401, data: { message: 'Unauthorized Access' } })
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    vi.advanceTimersByTime(61_000)
    const response = await client.post('/admins/password', { password: 'x' })
    expect(response).toMatchObject({
      status: 403,
      data: {
        status: 403,
        title: 'Forbidden',
        message: 'Confirmation required',
        confirmationRequired: true
      }
    })
    expect(
      await client.post('/admins/confirm-access', { password: 'wrong' })
    ).toMatchObject({ status: 401, data: { message: 'Password is incorrect' } })
    expect(
      await client.post('/admins/confirm-access', { password: 'secret' })
    ).toMatchObject({ status: 200, data: { success: true } })
    expect(
      (await client.post('/admins/password', { password: 'new' })).status
    ).toBe(200)
    expect(
      (await client.post('/admins/password', { password: '' })).data.errors
    ).toEqual({
      '/password': [
        { message: 'The password is required.', keyword: 'required' }
      ]
    })
  })

  it('serves and patches self', async () => {
    const { app } = setup({ db, source: admins, reconfirmAfter: 60_000 })
    const client = createClient(app)
    expect((await client.get('/admins/self')).data).toBe(null)
    expect((await client.patch('/admins/self', { name: 'A' })).status).toBe(401)
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    expect((await client.get('/admins/self')).data.username).toBe('ada')
    expect(
      (await client.patch('/admins/self', { name: 'Ada' })).data
    ).toMatchObject({ id: 1, name: 'Ada' })
    expect((await client.patch('/admins/self', { hash: 'x' })).status).toBe(400)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.advanceTimersByTime(61_000)
    // Unchanged usernames need no confirmation, new ones do:
    expect(
      (await client.patch('/admins/self', { username: 'ada' })).status
    ).toBe(200)
    expect(
      (await client.patch('/admins/self', { username: 'eve' })).data
        .confirmationRequired
    ).toBe(true)
    expect(
      (await client.patch('/admins/self', { password: 'x' })).status
    ).toBe(403)
    expect(ada.username).toBe('ada')
  })

  it('keeps the users of other sources out', async () => {
    const carl = await createUser(1, 'carl', 'secret', [])
    const customers = createSource('Customer', [carl], 'email')
    const admin = setup({ db, source: admins })
    const client = createClient(admin.app)
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    // The same cookie and store, routed for customers:
    const customer = setup({ db, source: customers })
    const other = createClient(customer.app)
    for (const [key, value] of client.jar) other.jar.set(key, value)
    expect((await other.get('/admins/session')).data.authenticated).toBe(false)
    expect(
      (await other.post('/admins/password', { password: 'x' })).status
    ).toBe(
      401
    )
    // The session of the admin stays:
    expect((await client.get('/admins/session')).data.authenticated).toBe(true)
    // Through `createApp()`:
    const api = new Hono()
    api.use(admin.sessions.middleware)
    for (const [source, path] of [
      [admins, '/admin'],
      [customers, '/customer']
    ] as const) {
      api.route(
        '/',
        createApp({
          base: path,
          getUser: sessionUser(admin.sessions, source),
          controllers: [
            defineController({
              path: 'me',
              authorize: true,
              collection: { get: c => c.var.user }
            })
          ]
        })
      )
    }
    const cookie = [...client.jar].map(([k, v]) => `${k}=${v}`).join('; ')
    const get = async (path: string) =>
      (
        await api.request(`https://example.com${path}`, {
          headers: { Cookie: cookie }
        })
      ).json()
    expect(await get('/admin/me')).toEqual({ id: 1, roles: ['admin'] })
    expect(await get('/customer/me')).toBe(null)
  })

  it('deletes expired sessions', async () => {
    const store = createSessionStore(() => db)
    await store.set({} as any, 'old', { _expire: Date.now() - 1 })
    await store.set({} as any, 'new', { _expire: Date.now() + 60_000 })
    await store.set({} as any, 'new', { a: 1, _expire: Date.now() + 60_000 })
    await deleteExpiredSessions(db)
    expect(await sessionIds()).toEqual(['new'])
    expect(await store.get({} as any, 'new')).toMatchObject({ a: 1 })
  })
})
