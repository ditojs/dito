import type { Kysely } from 'kysely'
import { TOTP } from 'otpauth'
import { createCredentials } from './credentials.ts'
import { createTotp } from './totp.ts'
import {
  createSource,
  createUser,
  setup,
  type TestUser,
  useTestDatabase
} from './test/helpers.ts'
import { createClient } from '../../../tests/utils/client.ts'

const getDb = useTestDatabase()
let db: Kysely<any>
let ada: TestUser
let client: ReturnType<typeof createClient>
let secret: string

const generate = (offset = 0) =>
  new TOTP({ secret }).generate({ timestamp: Date.now() + offset })

const login = () =>
  client.post('/admins/login', { username: 'ada', password: 'secret' })

const readTotp = async () => {
  const row = await db
    .selectFrom('credential')
    .selectAll()
    .where('type', '=', 'totp')
    .executeTakeFirstOrThrow()
  return row as Record<string, any>
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  db = getDb()
  ada = await createUser(1, 'ada', 'secret')
  const source = createSource('Admin', [ada])
  const credentials = createCredentials({
    adapter: { getKysely: () => db },
    source
  })
  const { api } = setup({
    db,
    source,
    credentials,
    totp: { issuer: 'Dito', secret: 'a long secret' }
  })
  client = createClient(api.fetch)
})

afterEach(() => {
  vi.useRealTimers()
})

async function setUpTotp() {
  await login()
  const { data } = await client.post('/admins/totp')
  secret = data.secret
  const response = await client.post('/admins/totp-confirm', {
    code: generate()
  })
  return response.data.backupCodes as string[]
}

describe('totp()', () => {
  it('sets up a secret with a code', async () => {
    await login()
    expect((await client.get('/admins/totp')).data).toEqual({
      enabled: false,
      backupCodes: 0
    })
    const { data } = await client.post('/admins/totp')
    expect(data.uri).toMatch(/^otpauth:\/\/totp\/Dito:ada\?.*issuer=Dito/)
    secret = data.secret
    expect(
      await client.post('/admins/totp-confirm', { code: '000000' })
    ).toMatchObject({ status: 401, data: { message: 'Code is incorrect' } })
    const response = await client.post('/admins/totp-confirm', {
      code: generate()
    })
    expect(response.status).toBe(200)
    expect(response.data.backupCodes).toHaveLength(10)
    expect(response.data.backupCodes[0]).toMatch(/^[\da-f]{5}-[\da-f]{5}$/)
    expect((await client.get('/admins/totp')).data).toEqual({
      enabled: true,
      backupCodes: 10
    })
    const { data: stored, user_model, user_id, key } = await readTotp()
    expect([user_model, user_id, key]).toEqual(['Admin', '1', 'totp-Admin-1'])
    // The secret and the backup codes aren't stored as they are:
    expect(stored.secret).not.toContain(secret)
    expect(stored.backupCodes).not.toContain(response.data.backupCodes[0])
    expect((await client.post('/admins/totp')).status).toBe(409)
    expect(
      (await client.post('/admins/totp-confirm', { code: generate() })).status
    ).toBe(400)
  })

  it('needs a pending secret that has not expired', async () => {
    await login()
    expect(
      await client.post('/admins/totp-confirm', { code: '000000' })
    ).toMatchObject({
      status: 400,
      data: { message: 'Missing or expired TOTP confirmation' }
    })
    secret = (await client.post('/admins/totp')).data.secret
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(
      (await client.post('/admins/totp-confirm', { code: generate() })).status
    ).toBe(400)
  })

  it('logs in with a code after the password', async () => {
    await setUpTotp()
    await client.post('/admins/logout')
    expect(await login()).toMatchObject({
      status: 200,
      data: { codeRequired: true }
    })
    expect((await client.get('/admins/self')).data).toBe(undefined)
    const pendingId = client.jar.get('admin.sess')
    expect(
      await client.post('/admins/login-code', { code: '000000' })
    ).toMatchObject({
      status: 401,
      data: { message: 'Code is incorrect' }
    })
    // The code that confirmed the secret can't be used again:
    expect(
      (await client.post('/admins/login-code', { code: generate() })).status
    ).toBe(401)
    vi.advanceTimersByTime(30_000)
    const response = await client.post('/admins/login-code', {
      code: generate()
    })
    expect(response.data).toMatchObject({ user: { id: 1 } })
    expect(client.jar.get('admin.sess')).not.toBe(pendingId)
    expect(
      (await client.post('/admins/login-code', { code: generate(30_000) }))
        .status
    ).toBe(400)
  })

  it('expires pending logins', async () => {
    await setUpTotp()
    await client.post('/admins/logout')
    await login()
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(
      await client.post('/admins/login-code', { code: generate() })
    ).toMatchObject({
      status: 400,
      data: { message: 'Missing or expired login' }
    })
  })

  it('accepts each backup code once', async () => {
    const [backupCode] = await setUpTotp()
    await client.post('/admins/logout')
    await login()
    expect(
      (
        await client.post('/admins/login-code', {
          code: backupCode.toUpperCase()
        })
      ).data.user.id
    ).toBe(1)
    expect((await client.get('/admins/totp')).data.backupCodes).toBe(9)
    await client.post('/admins/logout')
    await login()
    expect(
      (await client.post('/admins/login-code', { code: backupCode })).status
    ).toBe(401)
  })

  it('counts failures also when the request rolls back', async () => {
    await setUpTotp()
    const credentials = createCredentials({
      adapter: { getKysely: () => db },
      source: createSource('Admin', [ada])
    })
    const totp = createTotp(
      { issuer: 'Dito', secret: 'a long secret' },
      credentials
    )
    const rollback = new Error('Rolled back')
    await expect(
      db.transaction().execute(async () => {
        await expect(totp.verifyCode(ada, '000000')).rejects.toThrow()
        throw rollback
      })
    ).rejects.toBe(rollback)
    expect((await readTotp()).data.failures).toBe(1)
  })

  it('locks the codes after 10 failures', async () => {
    await setUpTotp()
    await client.post('/admins/logout')
    await login()
    for (let i = 1; i < 10; i++) {
      expect(
        (await client.post('/admins/login-code', { code: '000000' })).status
      ).toBe(401)
    }
    // The failures are stored, outside of any request transaction:
    expect((await readTotp()).data.failures).toBe(9)
    expect(
      await client.post('/admins/login-code', { code: '000000' })
    ).toMatchObject({ status: 400, data: { message: 'Too many attempts' } })
    vi.advanceTimersByTime(30_000)
    expect(
      (await client.post('/admins/login-code', { code: generate() })).status
    ).toBe(400)
    vi.advanceTimersByTime(15 * 60 * 1000)
    // The pending login expired meanwhile:
    await login()
    expect(
      (await client.post('/admins/login-code', { code: generate() })).data.user
        .id
    ).toBe(1)
    expect((await readTotp()).data).toMatchObject({
      failures: 0,
      lockedUntil: null
    })
  })

  it('asks for a code to confirm the access', async () => {
    await setUpTotp()
    expect(
      await client.post('/admins/confirm-access', { password: 'secret' })
    ).toMatchObject({ status: 200, data: { codeRequired: true } })
    vi.advanceTimersByTime(30_000)
    expect(
      (
        await client.post('/admins/confirm-access', {
          password: 'secret',
          code: '000000'
        })
      ).status
    ).toBe(401)
    expect(
      (
        await client.post('/admins/confirm-access', {
          password: 'secret',
          code: generate()
        })
      ).status
    ).toBe(204)
    expect((await client.delete('/admins/totp')).status).toBe(204)
    expect((await client.get('/admins/totp')).data.enabled).toBe(false)
  })

  it('rejects users with TOTP when the app no longer uses it', async () => {
    await setUpTotp()
    const { api } = setup({ db, source: createSource('Admin', [ada]) })
    const other = createClient(api.fetch)
    expect(
      await other.post('/admins/login', { username: 'ada', password: 'secret' })
    ).toMatchObject({
      status: 401,
      data: { message: 'Password or username is incorrect' }
    })
  })
})
