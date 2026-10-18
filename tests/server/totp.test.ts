import { vi } from 'vitest'
import {
  CredentialModel,
  PasskeyService,
  SessionModel,
  TotpService,
  UserModel,
  UsersController
} from '@ditojs/server'
import { TOTP } from 'otpauth'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createAuthenticator } from '../utils/authenticator.js'
import { createClient } from '../utils/client.js'
import { createTestDatabase } from '../utils/database.js'

const loginEvents: string[] = []

class Session extends SessionModel {
  declare value: Record<string, any>
}

class Credential extends CredentialModel {
  declare id: number
  declare type: string
  declare userModel: string
  declare userId: string
  declare data: Record<string, any>
  declare lastUsedAt: Date | null
}

class Member extends UserModel {
  declare id: number
  declare username: string

  static override hooks: any = {
    'after:login'(member: Member) {
      loginEvents.push(`after login ${member.username}`)
    }
  }
}

// Another user model, whose ids overlap with those of members:
class Guest extends UserModel {
  declare id: number
}

class Members extends UsersController {
  override modelClass = Member
}

class Guests extends UsersController {
  override modelClass = Guest
}

// Members whose actions are all transacted, unless they declare otherwise:
class TransactedMembers extends UsersController {
  override modelClass = Member
  override transacted = true
}

const authentication = { credentials: { modelClass: 'Credential' } }

type Client = ReturnType<typeof createClient>

describe('TOTP', () => {
  const app = createTestApp({
    config: {
      app: {
        name: 'Example',
        normalizePaths: true,
        helmet: false,
        keys: ['test-secret'],
        session: { modelClass: 'Session' },
        authentication
      },
      services: {
        passkeys: { domain: 'example.com', origins: ['https://example.com'] },
        totp: { secret: 'totp-secret' }
      }
    },
    services: { passkeys: PasskeyService, totp: TotpService },
    models: { Session, Credential, Member, Guest },
    controllers: { Members, Guests, TransactedMembers }
  })

  let url: string
  let member: Member

  const loginWithPassword = async (path = '/members') => {
    const request = createClient(url)
    const login = await request(`${path}/login`, {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    return { request, login }
  }

  const loginWithCode = async (code: string, path = '/members') => {
    const { request, login } = await loginWithPassword(path)
    expect(login.data.codeRequired).toBe(true)
    const response = await request(`${path}/login-code`, {
      method: 'POST',
      body: { code }
    })
    return { request, login: response }
  }

  // Set up TOTP for ada, and return the TOTP of her authenticator app:
  const setupTotp = async () => {
    const { request } = await loginWithPassword()
    const setup = await request('/members/totp', { method: 'POST' })
    expect(setup.status).toBe(200)
    const totp = new TOTP({
      issuer: 'Example',
      label: 'ada',
      secret: setup.data.secret
    })
    const confirm = await request('/members/totp-confirm', {
      method: 'POST',
      body: { code: totp.generate() }
    })
    expect(confirm.status).toBe(200)
    return { request, totp, setup, backupCodes: confirm.data.backupCodes }
  }

  // The setup used the current code, so logins use the next one, which is
  // accepted for clocks that drift:
  const getNextCode = (totp: TOTP) =>
    totp.generate({ timestamp: Date.now() + totp.period * 1000 })

  beforeAll(async () => {
    await createTestDatabase(app, Session, Member, Guest, Credential)
    for (const table of ['Member', 'Guest']) {
      await app.knex.schema.alterTable(table, table => {
        table.dropColumn('password')
      })
    }
    await app.start()
    url = getAppUrl(app)
    member = await Member.query().insert({
      username: 'ada',
      password: 'secret'
    } as any)
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
  })

  afterEach(async () => {
    loginEvents.length = 0
    await app.knex('Session').del()
    await app.knex('Credential').del()
  })

  it('sets up TOTP once the user confirms a code', async () => {
    const { request } = await loginWithPassword()
    const setup = await request('/members/totp', { method: 'POST' })
    expect(setup.data).toEqual({
      uri: expect.stringMatching(/^otpauth:\/\/totp\/Example:ada\?/),
      secret: expect.stringMatching(/^[A-Z2-7]+$/)
    })
    expect(setup.data.uri).toContain(`secret=${setup.data.secret}`)
    // Nothing is stored before the confirmation:
    expect(await Credential.query()).toEqual([])
    expect((await request('/members/totp')).data).toEqual({
      enabled: false,
      backupCodes: 0
    })

    const totp = new TOTP({ secret: setup.data.secret })
    const wrong = await request('/members/totp-confirm', {
      method: 'POST',
      body: { code: 'wrong' }
    })
    expect(wrong.status).toBe(401)
    expect(wrong.data.message).toBe('Code is incorrect')

    // The setup stays for another try:
    const confirm = await request('/members/totp-confirm', {
      method: 'POST',
      body: { code: totp.generate() }
    })
    expect(confirm.status).toBe(200)
    const { backupCodes } = confirm.data
    expect(backupCodes).toHaveLength(10)
    for (const code of backupCodes) {
      expect(code).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/)
    }
    expect((await request('/members/totp')).data).toEqual({
      enabled: true,
      backupCodes: 10
    })

    // The secret is stored encrypted, and the backup codes hashed, all in one
    // credential:
    const credentials = await Credential.query()
    expect(credentials).toHaveLength(1)
    const [credential] = credentials
    expect(credential).toMatchObject({
      type: 'totp',
      userModel: 'Member',
      userId: `${member.id}`
    })
    expect(credential.data.backupCodes).toHaveLength(10)
    const stored = JSON.stringify(credential.data)
    expect(stored).not.toContain(setup.data.secret)
    for (const code of backupCodes) {
      expect(stored).not.toContain(code.replace('-', ''))
    }

    // Each setup is confirmed once:
    const again = await request('/members/totp-confirm', {
      method: 'POST',
      body: { code: totp.generate() }
    })
    expect(again.status).toBe(400)
    expect(again.data.message).toBe('Missing or expired TOTP setup')
  })

  it('keeps setups after wrong codes, also in transacted controllers', async () => {
    const { request } = await loginWithPassword()
    const setup = await request('/transacted-members/totp', { method: 'POST' })
    const confirm = (code: string) =>
      request('/transacted-members/totp-confirm', {
        method: 'POST',
        body: { code }
      })
    for (let i = 0; i < 20; i++) {
      const wrong = await confirm('wrong')
      expect(wrong.status).toBe(401)
      expect(wrong.data.message).toBe('Code is incorrect')
    }
    const totp = new TOTP({ secret: setup.data.secret })
    expect((await confirm(totp.generate())).status).toBe(200)
    expect(await Credential.query()).toHaveLength(1)
  })

  it(`doesn't confirm setups once another one is confirmed`, async () => {
    const first = await loginWithPassword()
    const second = await loginWithPassword()
    const secrets = []
    for (const { request } of [first, second]) {
      const setup = await request('/members/totp', { method: 'POST' })
      secrets.push(setup.data.secret)
    }
    const confirm = ({ request }: { request: Client }, secret: string) =>
      request('/members/totp-confirm', {
        method: 'POST',
        body: { code: new TOTP({ secret }).generate() }
      })
    expect((await confirm(first, secrets[0])).status).toBe(200)
    const response = await confirm(second, secrets[1])
    expect(response.status).toBe(409)
    expect(response.data.message).toBe('TOTP is already set up')
    expect(await Credential.query().where('type', 'totp')).toHaveLength(1)
  })

  it('confirms only one of concurrent setups', async () => {
    // Requests through the app don't overlap reliably, so we call the service
    // directly, with the parts of contexts that it uses:
    const totp = app.getService('totp') as TotpService
    const contexts = [{ session: {} }, { session: {} }] as any[]
    const codes = contexts.map(ctx => {
      const { secret } = totp.createSecret(ctx, member)
      return new TOTP({ secret }).generate()
    })
    const results = await Promise.allSettled(
      contexts.map((ctx, index) =>
        totp.confirmSecret(ctx, member, codes[index])
      )
    )
    const statuses = results.map(result =>
      result.status === 'fulfilled' ? 200 : result.reason.status
    )
    expect(statuses.sort()).toEqual([200, 409])
    expect(await Credential.query().where('type', 'totp')).toHaveLength(1)
  })

  it(`doesn't set up TOTP twice`, async () => {
    const { request } = await setupTotp()
    const setup = await request('/members/totp', { method: 'POST' })
    expect(setup.status).toBe(409)
    expect(await Credential.query().where('type', 'totp')).toHaveLength(1)
  })

  it('asks users with TOTP for a code after their password', async () => {
    const { totp } = await setupTotp()
    loginEvents.length = 0
    const { request, login } = await loginWithPassword()
    expect(login.status).toBe(200)
    expect(login.data).toEqual({
      success: false,
      codeRequired: true,
      authenticated: false,
      user: null
    })
    expect(loginEvents).toEqual([])
    expect((await request('/members/session')).data.authenticated).toBe(false)

    const code = await request('/members/login-code', {
      method: 'POST',
      body: { code: getNextCode(totp) }
    })
    expect(code.status).toBe(200)
    expect(code.data).toMatchObject({
      success: true,
      authenticated: true,
      user: { id: member.id, username: 'ada' }
    })
    expect(code.data).not.toHaveProperty('codeRequired')
    expect(loginEvents).toEqual(['after login ada'])
    expect((await request('/members/session')).data.authenticated).toBe(true)
    const [credential] = await Credential.query().where('type', 'totp')
    expect(credential.lastUsedAt).toBeInstanceOf(Date)
  })

  it('logs in users without TOTP right away', async () => {
    const { login } = await loginWithPassword()
    expect(login.data).toMatchObject({ success: true, authenticated: true })
    expect(login.data).not.toHaveProperty('codeRequired')
  })

  it('accepts each code only once', async () => {
    const { totp } = await setupTotp()
    const code = getNextCode(totp)
    expect((await loginWithCode(code)).login.data.success).toBe(true)
    const { request, login } = await loginWithCode(code)
    expect(login.status).toBe(401)
    expect(login.data).toMatchObject({
      success: false,
      authenticated: false,
      error: 'Code is incorrect'
    })
    expect((await request('/members/session')).data.authenticated).toBe(false)
  })

  it(`doesn't accept the code of the setup`, async () => {
    // Freeze the time, so that the code can't change after the setup:
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const { totp } = await setupTotp()
      const { login } = await loginWithCode(totp.generate())
      expect(login.status).toBe(401)
    } finally {
      vi.useRealTimers()
    }
  })

  it('accepts each backup code once', async () => {
    const { request, backupCodes } = await setupTotp()
    const [code] = backupCodes
    // Backup codes ignore case and separators:
    const first = await loginWithCode(code.toUpperCase().replace('-', ' '))
    expect(first.login.data).toMatchObject({
      success: true,
      authenticated: true
    })
    expect((await request('/members/totp')).data).toEqual({
      enabled: true,
      backupCodes: 9
    })
    const [credential] = await Credential.query()
    expect(credential.data.backupCodes).toHaveLength(9)
    const second = await loginWithCode(code)
    expect(second.login.status).toBe(401)
    // The other backup codes stay:
    expect((await loginWithCode(backupCodes[1])).login.data.success).toBe(true)
  })

  it('regenerates the session id for the code', async () => {
    await setupTotp()
    const request = createClient(url)
    // Store something to create a session before logging in:
    await request('/members/passkey-login-options', { method: 'POST' })
    const ids = (await Session.query()).map(session => session.id)
    await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    const sessions = await Session.query()
    const session = sessions.find(session => session.value.pendingLogin)!
    expect(ids).not.toContain(session.id)
    // The session with the old id is gone:
    expect(sessions).toHaveLength(ids.length)
  })

  describe('wrong codes', () => {
    const postCode = (request: Client, code: string) =>
      request('/members/login-code', { method: 'POST', body: { code } })

    const getTotpData = async () =>
      (await Credential.query().findOne({ type: 'totp' }))!.data

    const enterWrongCodes = async (request: Client, count: number) => {
      for (let i = 0; i < count; i++) {
        const login = await postCode(request, 'wrong')
        expect(login.status).toBe(401)
        expect(login.data.error).toBe('Code is incorrect')
      }
    }

    it('lock the account after ten in a row', async () => {
      const { totp } = await setupTotp()
      const { request } = await loginWithPassword()
      await enterWrongCodes(request, 9)
      const last = await postCode(request, 'wrong')
      expect(last.status).toBe(400)
      expect(last.data.error).toBe('Too many attempts')
      // Also right codes are refused while the account is locked:
      const right = await postCode(request, getNextCode(totp))
      expect(right.status).toBe(400)
      expect(right.data.error).toBe('Too many attempts')
      expect((await getTotpData()).lockedUntil).toBeGreaterThan(Date.now())
    })

    it('lock the account also in transacted controllers', async () => {
      await setupTotp()
      const { request } = await loginWithPassword('/transacted-members')
      for (let i = 1; i < 10; i++) {
        const login = await request('/transacted-members/login-code', {
          method: 'POST',
          body: { code: 'wrong' }
        })
        expect(login.status).toBe(401)
      }
      const last = await request('/transacted-members/login-code', {
        method: 'POST',
        body: { code: 'wrong' }
      })
      expect(last.data.error).toBe('Too many attempts')
      expect((await getTotpData()).lockedUntil).toBeGreaterThan(Date.now())
    })

    it('lock the account when confirming the access in transacted controllers', async () => {
      const { request } = await setupTotp()
      const confirm = () =>
        request('/transacted-members/confirm-access', {
          method: 'POST',
          body: { password: 'secret', code: 'wrong' }
        })
      for (let i = 1; i < 10; i++) {
        expect((await confirm()).status).toBe(401)
      }
      expect((await confirm()).data.message).toBe('Too many attempts')
      expect((await getTotpData()).lockedUntil).toBeGreaterThan(Date.now())
    })

    it('count across logins with the password', async () => {
      const { totp } = await setupTotp()
      await enterWrongCodes((await loginWithPassword()).request, 5)
      // Logging in with the password again doesn't reset the count:
      const { request } = await loginWithPassword()
      await enterWrongCodes(request, 4)
      expect((await postCode(request, 'wrong')).status).toBe(400)
      const right = await postCode(request, getNextCode(totp))
      expect(right.data.error).toBe('Too many attempts')
    })

    it('start anew after a right code', async () => {
      const { totp } = await setupTotp()
      const { request } = await loginWithPassword()
      await enterWrongCodes(request, 9)
      expect((await postCode(request, getNextCode(totp))).status).toBe(200)
      await enterWrongCodes((await loginWithPassword()).request, 9)
      expect((await getTotpData()).failures).toBe(9)
    })

    it('unlock the account after the lock time', async () => {
      const { totp } = await setupTotp()
      const { request } = await loginWithPassword()
      await enterWrongCodes(request, 9)
      await postCode(request, 'wrong')
      const credential = await Credential.query().findOne({ type: 'totp' })
      await credential!.$query().patch({
        data: { ...credential!.data, lockedUntil: Date.now() - 1 }
      } as any)
      const login = await postCode(request, getNextCode(totp))
      expect(login.status).toBe(200)
      expect(await getTotpData()).toMatchObject({
        failures: 0,
        lockedUntil: null
      })
    })

    it('count concurrent requests', async () => {
      await setupTotp()
      const clients = await Promise.all(
        Array.from(
          { length: 10 },
          async () => (await loginWithPassword()).request
        )
      )
      const logins = await Promise.all(
        clients.map(request => postCode(request, 'wrong'))
      )
      expect(logins.map(({ status }) => status).sort()).toEqual([
        400,
        ...Array(9).fill(401)
      ])
      expect((await getTotpData()).lockedUntil).toBeGreaterThan(Date.now())
    })
  })

  it('accepts concurrent requests with the same code only once', async () => {
    const { totp } = await setupTotp()
    const clients = await Promise.all([
      loginWithPassword(),
      loginWithPassword()
    ])
    const code = getNextCode(totp)
    const logins = await Promise.all(
      clients.map(({ request }) =>
        request('/members/login-code', { method: 'POST', body: { code } })
      )
    )
    expect(logins.map(({ status }) => status).sort()).toEqual([200, 401])
  })

  it('binds the encrypted secret to its user', async () => {
    const { totp } = await setupTotp()
    const other = await Member.query().insert({
      username: 'bo',
      password: 'secret'
    } as any)
    try {
      // Give bo a copy of ada's credential, with her encrypted secret:
      const { data } = (await Credential.query().findOne({ type: 'totp' }))!
      await Credential.query().insert({
        type: 'totp',
        userModel: 'Member',
        userId: `${other.id}`,
        data
      } as any)
      const request = createClient(url)
      const login = await request('/members/login', {
        method: 'POST',
        body: { username: 'bo', password: 'secret' }
      })
      expect(login.data.codeRequired).toBe(true)
      const code = await request('/members/login-code', {
        method: 'POST',
        body: { code: getNextCode(totp) }
      })
      expect(code.data.success).toBe(false)
      expect((await request('/members/session')).data.authenticated).toBe(
        false
      )
    } finally {
      await Member.query().deleteById(other.id)
    }
  })

  it('rejects expired pending logins', async () => {
    const { totp } = await setupTotp()
    const { request } = await loginWithPassword()
    const session = (await Session.query()).find(
      session => session.value.pendingLogin
    )!
    await session.$query().patch({
      value: {
        ...session.value,
        pendingLogin: { ...session.value.pendingLogin, expires: Date.now() - 1 }
      }
    } as any)
    const login = await request('/members/login-code', {
      method: 'POST',
      body: { code: getNextCode(totp) }
    })
    expect(login.status).toBe(400)
    expect(login.data.error).toBe('Missing or expired login')
  })

  it('rejects codes without a pending login', async () => {
    const { totp } = await setupTotp()
    const request = createClient(url)
    const login = await request('/members/login-code', {
      method: 'POST',
      body: { code: getNextCode(totp) }
    })
    expect(login.status).toBe(400)
  })

  it('completes pending logins only for their user model', async () => {
    const { totp } = await setupTotp()
    const guest = await Guest.query().insert({ username: 'ada' } as any)
    try {
      expect(guest.id).toBe(member.id)
      const { request } = await loginWithPassword()
      const login = await request('/guests/login-code', {
        method: 'POST',
        body: { code: getNextCode(totp) }
      })
      expect(login.status).toBe(400)
      expect((await request('/guests/session')).data.authenticated).toBe(false)
    } finally {
      await Guest.query().deleteById(guest.id)
    }
  })

  it('lets passkey logins skip TOTP', async () => {
    const { request } = await setupTotp()
    const authenticator = createAuthenticator({
      origin: 'https://example.com',
      rpId: 'example.com'
    })
    const options = await request('/members/passkey-options', {
      method: 'POST'
    })
    await request('/members/passkeys', {
      method: 'POST',
      body: authenticator.register(options.data)
    })
    const client = createClient(url)
    const loginOptions = await client('/members/passkey-login-options', {
      method: 'POST'
    })
    const login = await client('/members/passkey-login', {
      method: 'POST',
      body: authenticator.authenticate(loginOptions.data)
    })
    expect(login.data).toMatchObject({ success: true, authenticated: true })
  })

  it('turns off TOTP with confirmed access, without a code', async () => {
    const { request } = await setupTotp()
    const remove = await request('/members/totp', { method: 'DELETE' })
    expect(remove.data).toEqual({ success: true })
    expect(await Credential.query()).toEqual([])
    const { login } = await loginWithPassword()
    expect(login.data).toMatchObject({ success: true, authenticated: true })
  })

  it('only lets logged-in users manage their TOTP', async () => {
    const request: Client = createClient(url)
    for (const [method, path] of [
      ['GET', 'totp'],
      ['POST', 'totp'],
      ['POST', 'totp-confirm'],
      ['DELETE', 'totp']
    ]) {
      const response = await request(`/members/${path}`, { method })
      expect(response.status).toBe(401)
    }
  })
})

describe('TOTP turned off', () => {
  // Models are only set up once, so the app needs its own user model:
  class User extends UserModel {}
  class Users extends UsersController {
    override modelClass = User
  }

  const app = createTestApp({
    config: {
      app: { normalizePaths: true, keys: ['test-secret'], session: true }
    },
    models: { User },
    controllers: { Users }
  })

  afterAll(() => app.knex.destroy())

  it(`doesn't route the TOTP actions`, async () => {
    await app.setup()
    const getHandler = (method: string, path: string) =>
      app.router.find(method, `/users/${path}`).handler
    expect(getHandler('POST', 'login')).toBeDefined()
    for (const [method, path] of [
      ['POST', 'login-code'],
      ['GET', 'totp'],
      ['POST', 'totp'],
      ['POST', 'totp-confirm'],
      ['DELETE', 'totp']
    ]) {
      expect(getHandler(method, path)).toBeUndefined()
    }
  })
})

describe('TOTP removed from apps', () => {
  // Models are only set up once, so the app needs its own models:
  class Session extends SessionModel {}
  class Credential extends CredentialModel {}
  class User extends UserModel {
    declare id: number
  }
  class Users extends UsersController {
    override modelClass = User
  }

  const app = createTestApp({
    config: {
      app: {
        normalizePaths: true,
        keys: ['test-secret'],
        session: { modelClass: 'Session' },
        authentication
      }
    },
    models: { Session, Credential, User },
    controllers: { Users }
  })

  beforeAll(async () => {
    await createTestDatabase(app, Session, Credential, User)
    await app.knex.schema.alterTable('User', table => {
      table.dropColumn('password')
    })
    await app.start()
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
  })

  const errors: Error[] = []
  const onError = (error: Error) => errors.push(error)

  beforeEach(async () => {
    app.on('error', onError)
    await User.query().insert({ username: 'ada', password: 'secret' } as any)
  })

  afterEach(async () => {
    app.off('error', onError)
    errors.length = 0
    await app.knex('Credential').del()
    await app.knex('User').del()
  })

  const login = (request: Client, password = 'secret') =>
    request('/users/login', {
      method: 'POST',
      body: { username: 'ada', password }
    })

  const addTotp = async () => {
    const user = await User.query().findOne('username', 'ada')
    await Credential.query().insert({
      type: 'totp',
      userModel: 'User',
      userId: `${user!.id}`,
      data: {}
    } as any)
  }

  // The answer doesn't tell that the password was right:
  const expectWrongPassword = (response: any, message: string) => {
    expect(response.status).toBe(401)
    expect(response.data.message ?? response.data.error).toBe(message)
    expect(errors.map(({ message }) => message)).toContain(
      `Controller Users: Unable to authenticate users with TOTP without ` +
      `'TotpService'.`
    )
  }

  it(`don't log in users with TOTP without their code`, async () => {
    await addTotp()
    const request = createClient(getAppUrl(app))
    const response = await login(request)
    expectWrongPassword(response, 'Password or username is incorrect')
    expect(response.data).toMatchObject({
      success: false,
      authenticated: false
    })
    // Like for a wrong password:
    const wrong = await login(createClient(getAppUrl(app)), 'wrong')
    expect(wrong.status).toBe(response.status)
    expect(wrong.data).toEqual(response.data)
    expect((await request('/users/session')).data.authenticated).toBe(false)
  })

  it(`don't confirm the access of users with TOTP without their code`, async () => {
    const request = createClient(getAppUrl(app))
    expect((await login(request)).data.success).toBe(true)
    await addTotp()
    const response = await request('/users/confirm-access', {
      method: 'POST',
      body: { password: 'secret' }
    })
    expectWrongPassword(response, 'Password is incorrect')
  })
})

describe('TOTP setup', () => {
  const setup = async (app: Record<string, any>, totp = {}) => {
    // Models are only set up once, so each app needs its own user model:
    class User extends UserModel {}
    class Users extends UsersController {
      override modelClass = User
    }
    const testApp = createTestApp({
      config: {
        app: { name: 'Example', keys: ['test-secret'], ...app },
        services: { totp: { secret: 'totp-secret', ...totp } }
      },
      services: { totp: TotpService },
      models: { Session, Credential, User },
      controllers: { Users }
    })
    try {
      await testApp.setup()
    } finally {
      await testApp.knex.destroy()
    }
  }

  const session = { modelClass: 'Session' }

  it('requires sessions stored on the server', async () => {
    for (const session of [true, { maxAge: 1000 }]) {
      await expect(setup({ session, authentication })).rejects.toThrow(
        `Unable to use TOTP without sessions stored on the server, ` +
        `see 'app.session'.`
      )
    }
  })

  it('requires credentials', async () => {
    await expect(setup({ session })).rejects.toThrow(
      `Unable to use TOTP without credentials, see ` +
      `'app.authentication.credentials'.`
    )
  })

  it('requires the secret', async () => {
    await expect(
      setup({ session, authentication }, { secret: undefined })
    ).rejects.toThrow(`Invalid TOTP, missing 'services.totp.secret'.`)
  })

  it('requires the name of the app', async () => {
    await expect(
      setup({ name: undefined, session, authentication })
    ).rejects.toThrow(
      `Invalid TOTP, missing 'app.name'.`
    )
  })
})
