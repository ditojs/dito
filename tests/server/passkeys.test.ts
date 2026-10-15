import {
  CredentialModel,
  PasskeyService,
  SessionModel,
  UserModel,
  UsersController
} from '@ditojs/server'
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
  declare key: string | null
  declare name: string | null
  declare data: Record<string, any>
  declare lastUsedAt: Date | null
}

class Member extends UserModel {
  declare id: number
  declare username: string

  static override options = {
    sessionScope: 'current'
  }

  static override scopes = {
    current: (query: any) => query.whereNot('username', 'retired')
  }

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

const passkeys = {
  domain: 'example.com',
  origins: ['https://example.com']
}

describe('Passkeys', () => {
  const app = createTestApp({
    config: {
      app: {
        name: 'Example',
        normalizePaths: true,
        helmet: false,
        keys: ['test-secret'],
        session: { modelClass: 'Session' },
        authentication: { credentials: { modelClass: 'Credential' } }
      },
      services: { passkeys }
    },
    services: { passkeys: PasskeyService },
    models: { Session, Credential, Member, Guest },
    controllers: { Members, Guests, TransactedMembers }
  })

  let url: string
  let member: Member

  const loginWithPassword = async (username = 'ada') => {
    const request = createClient(url)
    const login = await request('/members/login', {
      method: 'POST',
      body: { username, password: 'secret' }
    })
    expect(login.data.success).toBe(true)
    return request
  }

  const registerPasskey = async (
    request: ReturnType<typeof createClient>,
    authenticator = createAuthenticator({
      origin: 'https://example.com',
      rpId: 'example.com'
    })
  ) => {
    const options = await request('/members/passkey-options', {
      method: 'POST'
    })
    expect(options.status).toBe(200)
    const passkey = await request('/members/passkeys', {
      method: 'POST',
      body: authenticator.register(options.data)
    })
    expect(passkey.status).toBe(200)
    return { authenticator, passkey: passkey.data }
  }

  const loginWithPasskey = async (
    authenticator: ReturnType<typeof createAuthenticator>,
    path = '/members'
  ) => {
    const request = createClient(url)
    const options = await request(`${path}/passkey-login-options`, {
      method: 'POST'
    })
    const login = await request(`${path}/passkey-login`, {
      method: 'POST',
      body: authenticator.authenticate(options.data)
    })
    return { request, login }
  }

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

  it('registers passkeys of the logged-in user', async () => {
    const request = await loginWithPassword()
    const { authenticator, passkey } = await registerPasskey(request)
    expect(passkey).toEqual({
      id: expect.any(Number),
      name: 'Passkey',
      createdAt: expect.any(String),
      lastUsedAt: null
    })
    const [credential] = await Credential.query()
    expect(credential).toMatchObject({
      type: 'passkey',
      userModel: 'Member',
      userId: `${member.id}`,
      key: authenticator.id,
      name: 'Passkey',
      data: { counter: 0, transports: ['internal'] }
    })
    expect(credential.data.publicKey).toEqual(expect.any(String))
  })

  it('names passkeys after their providers', async () => {
    const request = await loginWithPassword()
    const { passkey } = await registerPasskey(
      request,
      createAuthenticator({
        origin: 'https://example.com',
        rpId: 'example.com',
        aaguid: 'bada5566-a7aa-401f-bd96-45619a55120d'
      })
    )
    expect(passkey.name).toBe('1Password')
    // Unknown providers are named like anonymous ones:
    const { passkey: unknown } = await registerPasskey(
      request,
      createAuthenticator({
        origin: 'https://example.com',
        rpId: 'example.com',
        aaguid: '01020304-0506-0708-0102-030405060708'
      })
    )
    expect(unknown.name).toBe('Passkey')
  })

  it('lists the passkeys without their keys', async () => {
    const request = await loginWithPassword()
    const { passkey } = await registerPasskey(request)
    const list = await request('/members/passkeys')
    expect(list.data).toEqual([passkey])
  })

  it(`excludes the user's passkeys from new registrations`, async () => {
    const request = await loginWithPassword()
    const { authenticator } = await registerPasskey(request)
    const options = await request('/members/passkey-options', {
      method: 'POST'
    })
    expect(options.data).toMatchObject({
      rp: { name: 'Example', id: 'example.com' },
      user: { name: 'ada' },
      excludeCredentials: [{ id: authenticator.id, transports: ['internal'] }]
    })
  })

  it('logs in with passkeys', async () => {
    const { authenticator } = await registerPasskey(await loginWithPassword())
    loginEvents.length = 0
    const { request, login } = await loginWithPasskey(authenticator)
    expect(login.status).toBe(200)
    expect(login.data).toMatchObject({
      success: true,
      authenticated: true,
      user: { id: member.id, username: 'ada' }
    })
    expect(login.data.user).not.toHaveProperty('hash')
    expect(loginEvents).toEqual(['after login ada'])
    expect((await request('/members/session')).data).toMatchObject({
      authenticated: true,
      user: { id: member.id }
    })
    const [credential] = await Credential.query()
    expect(credential.data.counter).toBe(1)
    expect(credential.lastUsedAt).toBeInstanceOf(Date)
    const updated = await Member.query().findById(member.id)
    expect(updated!.lastLogin).toBeInstanceOf(Date)
  })

  it('updates the counter with each login and rejects replays', async () => {
    const { authenticator } = await registerPasskey(await loginWithPassword())
    await loginWithPasskey(authenticator)
    await loginWithPasskey(authenticator)
    const [credential] = await Credential.query()
    expect(credential.data.counter).toBe(2)

    // A cloned authenticator answers with an earlier counter:
    authenticator.counter = 1
    const { login } = await loginWithPasskey(authenticator)
    expect(login.status).toBe(401)
    expect(login.data.success).toBe(false)
  })

  it('rejects logins that answer another challenge', async () => {
    const { authenticator } = await registerPasskey(await loginWithPassword())
    const request = createClient(url)
    await request('/members/passkey-login-options', { method: 'POST' })
    const login = await request('/members/passkey-login', {
      method: 'POST',
      body: authenticator.authenticate({ challenge: 'd3Jvbmc' })
    })
    expect(login.status).toBe(401)
    // Clients don't learn why passkeys fail:
    expect(login.data).toMatchObject({
      success: false,
      authenticated: false,
      error: 'Passkey is incorrect'
    })
    expect((await request('/members/session')).data.authenticated).toBe(false)
  })

  it('answers each challenge only once', async () => {
    const { authenticator } = await registerPasskey(await loginWithPassword())
    const request = createClient(url)
    const options = await request('/members/passkey-login-options', {
      method: 'POST'
    })
    const body = authenticator.authenticate(options.data)
    await request('/members/passkey-login', { method: 'POST', body })
    const login = await request('/members/passkey-login', {
      method: 'POST',
      body
    })
    expect(login.status).toBe(400)
    expect(login.data.error).toBe('Missing or expired passkey challenge')
  })

  it('rejects expired challenges', async () => {
    const { authenticator } = await registerPasskey(await loginWithPassword())
    const request = createClient(url)
    const options = await request('/members/passkey-login-options', {
      method: 'POST'
    })
    // Let the challenge of the stored session expire:
    const session = (await Session.query()).find(
      session => session.value.authenticationChallenge
    )!
    await session.$query().patch({
      value: {
        ...session.value,
        authenticationChallenge: {
          ...session.value.authenticationChallenge,
          expires: Date.now() - 1
        }
      }
    } as any)
    const login = await request('/members/passkey-login', {
      method: 'POST',
      body: authenticator.authenticate(options.data)
    })
    expect(login.status).toBe(400)
    expect(login.data.error).toBe('Missing or expired passkey challenge')
  })

  it('rejects passkeys that are already registered', async () => {
    const other = await Member.query().insert({
      username: 'bo',
      password: 'secret'
    } as any)
    try {
      const { authenticator } = await registerPasskey(await loginWithPassword())
      const request = await loginWithPassword('bo')
      const options = await request('/members/passkey-options', {
        method: 'POST'
      })
      const passkey = await request('/members/passkeys', {
        method: 'POST',
        body: authenticator.register(options.data)
      })
      expect(passkey.status).toBe(409)
      const credentials = await Credential.query()
      expect(credentials.map(({ userId }) => userId)).toEqual([
        `${member.id}`
      ])
    } finally {
      await Member.query().deleteById(other.id)
    }
  })

  it('rejects registrations that answer another challenge', async () => {
    const request = await loginWithPassword()
    await request('/members/passkey-options', { method: 'POST' })
    const authenticator = createAuthenticator({
      origin: 'https://example.com',
      rpId: 'example.com'
    })
    const passkey = await request('/members/passkeys', {
      method: 'POST',
      body: authenticator.register({ challenge: 'd3Jvbmc' })
    })
    expect(passkey.status).toBe(400)
    expect(await Credential.query()).toEqual([])
  })

  it('only accepts the configured origins', async () => {
    const request = await loginWithPassword()
    const options = await request('/members/passkey-options', {
      method: 'POST'
    })
    // Subdomains of the domain are only accepted when listed in `origins`:
    const authenticator = createAuthenticator({
      origin: 'https://admin.example.com',
      rpId: 'example.com'
    })
    const passkey = await request('/members/passkeys', {
      method: 'POST',
      body: authenticator.register(options.data)
    })
    expect(passkey.status).toBe(400)
    expect(passkey.data.message).toMatch(/origin "https:\/\/admin\./)
    expect(await Credential.query()).toEqual([])
  })

  it('consumes registration challenges also in transacted controllers', async () => {
    const request = await loginWithPassword()
    const options = await request('/transacted-members/passkey-options', {
      method: 'POST'
    })
    const authenticator = createAuthenticator({
      origin: 'https://example.com',
      rpId: 'example.com'
    })
    const register = (challenge: string) =>
      request('/transacted-members/passkeys', {
        method: 'POST',
        body: authenticator.register({ ...options.data, challenge })
      })
    expect((await register('d3Jvbmc')).status).toBe(400)
    const passkey = await register(options.data.challenge)
    expect(passkey.status).toBe(400)
    expect(passkey.data.message).toBe('Missing or expired passkey challenge')
    expect(await Credential.query()).toEqual([])
  })

  it('rejects passkeys of other user models', async () => {
    const { authenticator } = await registerPasskey(await loginWithPassword())
    const guest = await Guest.query().insert({ username: 'ada' } as any)
    try {
      expect(guest.id).toBe(member.id)
      const { login } = await loginWithPasskey(authenticator, '/guests')
      expect(login.status).toBe(401)
      expect(login.data).toMatchObject({
        success: false,
        error: 'Passkey is incorrect'
      })
    } finally {
      await Guest.query().deleteById(guest.id)
    }
  })

  it('rejects passkeys of users excluded by the session scope', async () => {
    const other = await Member.query().insert({
      username: 'bo',
      password: 'secret'
    } as any)
    try {
      const { authenticator } = await registerPasskey(
        await loginWithPassword('bo')
      )
      await Member.query().patchById(other.id, { username: 'retired' })
      const { login } = await loginWithPasskey(authenticator)
      expect(login.status).toBe(401)
      // The passkey stays unused:
      const [credential] = await Credential.query()
      expect(credential.data.counter).toBe(0)
      expect(credential.lastUsedAt).toBeNull()
    } finally {
      await Member.query().deleteById(other.id)
    }
  })

  it('only lets logged-in users manage their passkeys', async () => {
    const request = createClient(url)
    expect((await request('/members/passkeys')).status).toBe(401)
    for (const path of ['passkey-options', 'passkeys']) {
      const response = await request(`/members/${path}`, { method: 'POST' })
      expect(response.status).toBe(401)
    }
    const remove = await request('/members/passkeys/1', { method: 'DELETE' })
    expect(remove.status).toBe(401)
  })

  it('deletes only the own passkeys', async () => {
    const request = await loginWithPassword()
    const { passkey } = await registerPasskey(request)
    const other = await Credential.query().insert({
      type: 'passkey',
      userModel: 'Member',
      userId: `${member.id + 1}`,
      key: 'other',
      data: {}
    })
    const guest = await Credential.query().insert({
      type: 'passkey',
      userModel: 'Guest',
      userId: `${member.id}`,
      key: 'guest',
      data: {}
    })
    for (const { id } of [other, guest]) {
      const response = await request(`/members/passkeys/${id}`, {
        method: 'DELETE'
      })
      expect(response.status).toBe(404)
    }
    const response = await request(`/members/passkeys/${passkey.id}`, {
      method: 'DELETE'
    })
    expect(response.data).toEqual({ success: true })
    expect((await Credential.query()).map(({ key }) => key).sort()).toEqual([
      'guest',
      'other'
    ])
  })

  it('deletes the credentials of deleted users', async () => {
    const other = await Member.query().insert({
      username: 'bo',
      password: 'secret'
    } as any)
    await registerPasskey(await loginWithPassword('bo'))
    await registerPasskey(await loginWithPassword())
    // A guest with the same id keeps its credentials:
    await Credential.query().insert({
      type: 'passkey',
      userModel: 'Guest',
      userId: `${other.id}`,
      key: 'guest',
      data: {}
    })
    await Member.query().where('username', 'bo').delete()
    const credentials = await Credential.query().orderBy('userModel')
    expect(
      credentials.map(({ userModel, userId }) => `${userModel}-${userId}`)
    ).toEqual([`Guest-${other.id}`, `Member-${member.id}`])
  })
})

describe('Passkeys turned off', () => {
  // Models are only set up once, so the app needs its own user model:
  class User extends UserModel {}
  class Users extends UsersController {
    override modelClass = User
    // A member action of the app, named like a passkey action:
    override member: any = {
      'get passkeys'() {
        return []
      }
    }
  }

  const app = createTestApp({
    config: {
      app: { normalizePaths: true, keys: ['test-secret'], session: true }
    },
    models: { User },
    controllers: { Users }
  })

  afterAll(() => app.knex.destroy())

  it(`doesn't route the passkey actions`, async () => {
    await app.setup()
    const getHandler = (method: string, path: string) =>
      app.router.find(method, `/users/${path}`).handler
    expect(getHandler('POST', 'login')).toBeDefined()
    for (const [method, path] of [
      ['POST', 'passkey-login-options'],
      ['POST', 'passkey-login'],
      ['GET', 'passkeys'],
      ['POST', 'passkey-options'],
      ['POST', 'passkeys'],
      ['DELETE', 'passkeys/1']
    ]) {
      expect(getHandler(method, path)).toBeUndefined()
    }
    expect(getHandler('GET', '1/passkeys')).toBeDefined()
  })
})

describe('Passkey domains', () => {
  // Each app needs its own models, as models are only set up once:
  const createDomainApp = (
    config: Record<string, unknown> | true,
    { proxy = true } = {}
  ) => {
    class Session extends SessionModel {}
    class Credential extends CredentialModel {}
    class User extends UserModel {}
    class Users extends UsersController {
      override modelClass = User
    }
    const app = createTestApp({
      config: {
        app: {
          name: 'Example',
          normalizePaths: true,
          // Trust `X-Forwarded-Host`, as the requests reach the app through
          // its loopback address:
          proxy,
          keys: ['test-secret'],
          session: { modelClass: 'Session' },
          authentication: { credentials: { modelClass: 'Credential' } }
        },
        services: { passkeys: config }
      },
      services: { passkeys: PasskeyService },
      models: { Session, Credential, User },
      controllers: { Users }
    })
    // Register a passkey through a page of `origin`, with requests to `host`:
    const register = async (host: string, origin: string) => {
      const request = createClient(getAppUrl(app), {
        'x-forwarded-host': host
      })
      await request('/users/login', {
        method: 'POST',
        body: { username: 'ada', password: 'secret' }
      })
      const options = await request('/users/passkey-options', {
        method: 'POST'
      })
      const authenticator = createAuthenticator({
        origin,
        rpId: options.data.rp.id
      })
      const passkey = await request('/users/passkeys', {
        method: 'POST',
        body: authenticator.register(options.data)
      })
      // Log in with the passkey again, on the same page, with requests to
      // `loginHost`:
      const login = async (loginHost = host) => {
        const request = createClient(getAppUrl(app), {
          'x-forwarded-host': loginHost
        })
        const options = await request('/users/passkey-login-options', {
          method: 'POST'
        })
        const response = await request('/users/passkey-login', {
          method: 'POST',
          body: authenticator.authenticate(options.data)
        })
        return { rpId: options.data.rpId, status: response.status }
      }
      return { rpId: options.data.rp.id, status: passkey.status, login }
    }
    beforeAll(async () => {
      await createTestDatabase(app, Session, Credential, User)
      await app.knex.schema.alterTable('User', table => {
        table.dropColumn('password')
      })
      await app.start()
      await User.query().insert({ username: 'ada', password: 'secret' } as any)
    })
    afterAll(async () => {
      await app.stop()
      await app.knex.destroy()
    })
    return { register }
  }

  describe('by default', () => {
    const { register } = createDomainApp(true)

    it('belong to the domain of the request', async () => {
      const { login, ...registration } = await register(
        'example.org',
        'https://example.org'
      )
      expect(registration).toEqual({ rpId: 'example.org', status: 200 })
      expect(await login()).toEqual({ rpId: 'example.org', status: 200 })
      // Other domains, also subdomains, don't accept them:
      for (const host of ['example.net', 'www.example.org']) {
        expect(await login(host)).toEqual({ rpId: host, status: 401 })
      }
    })

    it('are used by the pages of the domain and its subdomains', async () => {
      for (const origin of [
        'https://admin.example.org',
        'https://a.b.example.org:8443'
      ]) {
        expect((await register('example.org', origin)).status).toBe(200)
      }
    })

    it('are used over http only on localhost', async () => {
      expect(
        await register('localhost:8080', 'http://localhost:8080')
      ).toMatchObject({ rpId: 'localhost', status: 200 })
      expect(
        await register('example.org', 'http://example.org')
      ).toMatchObject({ status: 400 })
    })

    it('reject the pages of other domains', async () => {
      for (const origin of [
        'https://example.com',
        'https://notexample.org',
        'https://example.org.example.com'
      ]) {
        expect((await register('example.org', origin)).status).toBe(400)
      }
    })
  })

  describe('without app.proxy', () => {
    const { register } = createDomainApp(true, { proxy: false })

    it('ignore the forwarded host of the request', async () => {
      expect(
        await register('example.org', 'https://example.org')
      ).toMatchObject({ rpId: '127.0.0.1', status: 400 })
    })
  })

  describe('with a domain', () => {
    const { register } = createDomainApp({ domain: 'example.org' })

    it('are shared by the subdomains', async () => {
      const { login, ...registration } = await register(
        'api.example.org',
        'https://www.example.org'
      )
      expect(registration).toEqual({ rpId: 'example.org', status: 200 })
      expect(await login()).toEqual({ rpId: 'example.org', status: 200 })
    })
  })
})

describe('Passkeys setup', () => {
  const setup = async (app: Record<string, any>) => {
    // Models are only set up once, so each app needs its own user model:
    class User extends UserModel {}
    class Users extends UsersController {
      override modelClass = User
    }
    const testApp = createTestApp({
      config: {
        app: { name: 'Example', keys: ['test-secret'], ...app },
        services: { passkeys: true }
      },
      services: { passkeys: PasskeyService },
      models: { Session, Credential, User },
      controllers: { Users }
    })
    try {
      await testApp.setup()
    } finally {
      await testApp.knex.destroy()
    }
  }

  const credentials = { modelClass: 'Credential' }

  it('requires the name of the app', async () => {
    await expect(
      setup({
        name: undefined,
        session: { modelClass: 'Session' },
        authentication: { credentials }
      })
    ).rejects.toThrow(`Invalid passkeys, missing 'app.name'.`)
  })

  it('requires sessions stored on the server', async () => {
    for (const session of [true, { maxAge: 1000 }]) {
      await expect(
        setup({ session, authentication: { credentials } })
      ).rejects.toThrow(
        `Unable to use passkeys without sessions stored on the server, ` +
        `see 'app.session'.`
      )
    }
  })

  it('requires credentials', async () => {
    await expect(setup({ session: { modelClass: 'Session' } })).rejects.toThrow(
      `Unable to use passkeys without credentials, see ` +
      `'app.authentication.credentials'.`
    )
  })

  it('requires a known credential model', async () => {
    await expect(
      setup({ authentication: { credentials: { modelClass: 'Unknown' } } })
    ).rejects.toThrow(`Unable to find credential model class: 'Unknown'.`)
  })
})
