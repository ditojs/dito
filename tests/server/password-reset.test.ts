import type { ModelProperties } from '@ditojs/server'
import { UserModel, UsersController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createClient } from '../utils/client.js'
import { createTestDatabase } from '../utils/database.js'

const sentResets: { user: string; url: string }[] = []

const getLinkToken = (link: string) =>
  new URLSearchParams(new URL(link).hash.slice(1)).get('password-reset')!

class Member extends UserModel {
  declare id: number
  declare username: string
  declare email: string | null

  static override options = {
    sessionScope: 'current'
  }

  static override properties: ModelProperties = {
    password: {
      type: 'string',
      computed: true,
      minLength: 6
    },
    email: {
      type: 'string',
      nullable: true
    }
  }

  static override scopes = {
    current: (query: any) => query.whereNot('username', 'retired')
  }
}

// Another user model, whose ids overlap with those of members:
class Guest extends UserModel {
  declare id: number
}

class Members extends UsersController {
  override modelClass = Member

  // Members change their username through `PATCH /members/self`:
  override member: any = {
    allow: ['patch']
  }

  // Not async, so that its errors are thrown right away:
  override sendPasswordReset(ctx: any, user: Member, url: string) {
    if (user.username === 'broken') {
      throw new Error('Unable to send')
    }
    sentResets.push({ user: user.username, url })
  }
}

// Members whose password reset links also depend on their email:
class EmailMembers extends Members {
  override getPasswordResetTokenValues(user: Member) {
    return [...super.getPasswordResetTokenValues(user), user.email]
  }
}

// Members that relate existing members when posting them with ids:
class Relaters extends Members {
  override relate = true
  override collection: any = {
    allow: ['post'],
    authorize: { post: true }
  }
}

// Members that patch any member through the collection:
class Moderators extends Members {
  override collection: any = {
    allow: ['patch'],
    authorize: { patch: true }
  }
}

class Guests extends UsersController {
  override modelClass = Guest

  override async sendPasswordReset(ctx: any, user: Guest, url: string) {
    sentResets.push({ user: 'guest', url })
  }
}

// Password resets only need `app.keys`, no credentials or stored sessions:
const auth = {
  passwordReset: {
    confirmUrl: 'https://example.com/admin/#password-reset={token}',
    expiresAfter: '30m'
  }
}

describe('Password reset', () => {
  const app = createTestApp({
    config: {
      app: {
        normalizePaths: true,
        helmet: false,
        keys: ['test-secret'],
        session: true,
        auth
      }
    },
    models: { Member, Guest },
    controllers: {
      Members,
      EmailMembers,
      Guests,
      Relaters,
      Moderators
    }
  })

  let url: string
  let member: Member

  const requestReset = async (
    username: string | Record<string, unknown> = 'ada',
    path = '/members'
  ) =>
    createClient(url)(`${path}/password-reset`, {
      method: 'POST',
      body: typeof username === 'string' ? { username } : username
    })

  // Request a reset for the user, and return the token of the sent link:
  const getToken = async (username = 'ada', path = '/members') => {
    await requestReset(username, path)
    const [{ url }] = sentResets.splice(0)
    return getLinkToken(url)
  }

  const confirmReset = async (
    token: string,
    password = 'changed',
    request = createClient(url),
    path = '/members'
  ) =>
    request(`${path}/password-reset-confirm`, {
      method: 'POST',
      body: { token, password }
    })

  const login = async (password: string, username = 'ada') => {
    const request = createClient(url)
    const response = await request('/members/login', {
      method: 'POST',
      body: { username, password }
    })
    return { request, success: response.data.success }
  }

  const isAuthenticated = async (request: ReturnType<typeof createClient>) =>
    (await request('/members/session')).data.authenticated

  const expectInvalid = async (token: string) => {
    const response = await confirmReset(token)
    expect(response.status).toBe(400)
    expect(response.data.message).toBe('Invalid or expired token')
  }

  beforeAll(async () => {
    await createTestDatabase(app, Member, Guest)
    for (const table of ['Member', 'Guest']) {
      await app.knex.schema.alterTable(table, table => {
        table.dropColumn('password')
      })
    }
    await app.start()
    url = getAppUrl(app)
  })

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
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
    vi.useRealTimers()
    sentResets.length = 0
    await app.knex('Member').del()
    await app.knex('Guest').del()
  })

  it('sends a link with a token', async () => {
    const response = await requestReset()
    expect(response.status).toBe(200)
    expect(response.data).toEqual({ success: true })
    expect(sentResets).toEqual([
      {
        user: 'ada',
        url: expect.stringMatching(
          /^https:\/\/example\.com\/admin\/#password-reset=[\w-]+\.[\da-z]+\.[\w-]{43}$/
        )
      }
    ])
  })

  it('answers the same for unknown usernames', async () => {
    const known = await requestReset()
    const unknown = await requestReset('nobody')
    expect(unknown.status).toBe(known.status)
    expect(unknown.data).toEqual(known.data)
    expect(sentResets.map(({ user }) => user)).toEqual(['ada'])
  })

  it('answers the same for users excluded by the session scope', async () => {
    await Member.query().patchById(member.id, { username: 'retired' })
    const response = await requestReset('retired')
    expect(response.status).toBe(200)
    expect(response.data).toEqual({ success: true })
    expect(sentResets).toEqual([])
  })

  it('rejects requests without a valid username', async () => {
    for (const [body, message] of [
      [{}, 'Missing username'],
      [{ username: ['ada'] }, 'Invalid username']
    ] as const) {
      const response = await createClient(url)('/members/password-reset', {
        method: 'POST',
        body
      })
      expect(response.status).toBe(400)
      expect(response.data.message).toBe(message)
    }
    expect(sentResets).toEqual([])
  })

  it('answers the same when sending fails right away', async () => {
    await Member.query().insert({
      username: 'broken',
      password: 'secret'
    } as any)
    const errors: Error[] = []
    const onError = (error: Error) => errors.push(error)
    app.on('error', onError)
    try {
      const response = await requestReset('broken')
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ success: true })
      await vi.waitFor(() => expect(errors).toHaveLength(1))
      expect(errors[0].message).toBe('Unable to send')
    } finally {
      app.off('error', onError)
    }
  })

  it('sets the new password, without logging in', async () => {
    const token = await getToken()
    const request = createClient(url)
    const response = await confirmReset(token, 'changed', request)
    expect(response.status).toBe(200)
    expect(response.data).toEqual({ success: true })
    expect(await isAuthenticated(request)).toBe(false)
    expect((await login('secret')).success).toBe(false)
    expect((await login('changed')).success).toBe(true)
  })

  it('accepts each token only once', async () => {
    const token = await getToken()
    expect((await confirmReset(token)).status).toBe(200)
    await expectInvalid(token)
    expect((await login('changed')).success).toBe(true)
  })

  it('invalidates the other links of the user with the reset', async () => {
    const first = await getToken()
    vi.setSystemTime(Date.now() + 1000)
    const second = await getToken()
    expect((await confirmReset(second)).status).toBe(200)
    await expectInvalid(first)
  })

  it('invalidates the links of the user with logins', async () => {
    const token = await getToken()
    expect((await login('secret')).success).toBe(true)
    expect((await confirmReset(token)).status).toBe(400)
  })

  it('invalidates the links of the user with password changes', async () => {
    const { request } = await login('secret')
    const token = await getToken()
    const response = await request('/members/password', {
      method: 'POST',
      body: { currentPassword: 'secret', password: 'changed' }
    })
    expect(response.status).toBe(200)
    expect((await confirmReset(token, 'another')).status).toBe(400)
  })

  it('invalidates the links of the user with username changes', async () => {
    const { request } = await login('secret')
    const token = await getToken()
    const response = await request('/members/self', {
      method: 'PATCH',
      body: { username: 'eve' }
    })
    expect(response.status).toBe(200)
    expect((await confirmReset(token, 'another')).status).toBe(400)
  })

  it('invalidates the links of the user with username changes by relating', async () => {
    const { request } = await login('secret')
    const token = await getToken()
    const response = await request('/relaters', {
      method: 'POST',
      body: { id: member.id, username: 'eve' }
    })
    expect(response.status).toBe(201)
    expect(response.data.username).toBe('eve')
    expect((await confirmReset(token, 'another')).status).toBe(400)
  })

  it('invalidates the links of the user with username changes in collections', async () => {
    const { request } = await login('secret')
    const token = await getToken()
    const response = await request('/moderators', {
      method: 'PATCH',
      body: [{ id: member.id, username: 'eve' }]
    })
    expect(response.status).toBe(200)
    expect(response.data).toMatchObject([{ username: 'eve' }])
    expect((await confirmReset(token, 'another')).status).toBe(400)
  })

  it('keeps the links of the user with changes of other values', async () => {
    const token = await getToken()
    await Member.query().patchById(member.id, { email: 'ada@example.com' })
    expect((await confirmReset(token)).status).toBe(200)
  })

  it('invalidates the links with changes of values added by overrides', async () => {
    const confirm = async (token: string) =>
      confirmReset(token, 'changed', createClient(url), '/email-members')
    const token = await getToken('ada', '/email-members')
    await Member.query().patchById(member.id, { email: 'ada@example.com' })
    expect((await confirm(token)).status).toBe(400)
    // Links sent after the change work:
    const other = await getToken('ada', '/email-members')
    expect((await confirm(other)).status).toBe(200)
  })

  it('keeps the links of other users', async () => {
    await Member.query().insert({ username: 'bob', password: 'secret' } as any)
    const token = await getToken('bob')
    const { request } = await login('secret')
    await request('/members/password', {
      method: 'POST',
      body: { currentPassword: 'secret', password: 'changed' }
    })
    await request('/members/self', {
      method: 'PATCH',
      body: { username: 'eve' }
    })
    expect((await confirmReset(token)).status).toBe(200)
    expect((await login('changed', 'bob')).success).toBe(true)
  })

  it('rejects expired tokens', async () => {
    const token = await getToken()
    // The token is still accepted just before, as the validation shows:
    vi.setSystemTime(Date.now() + 30 * 60 * 1000 - 1)
    const response = await confirmReset(token, 'short')
    expect(response.data.type).toBe('ModelValidation')
    vi.setSystemTime(Date.now() + 1)
    await expectInvalid(token)
    expect((await login('secret')).success).toBe(true)
  })

  it('rejects malformed tokens', async () => {
    const token = await getToken()
    const [id, time, mac] = token.split('.')
    for (const malformed of [
      'unknown',
      '..',
      `${id}.${time}`,
      `${id}.${time}.${mac}.${mac}`,
      `${id}.${time}x.${mac}`
    ]) {
      await expectInvalid(malformed)
    }
  })

  it('signs tokens with the first key and accepts all keys', async () => {
    const { keys } = app as { keys: string[] }
    const token = await getToken()
    // Rotate the keys, as apps do by adding a new key in front:
    keys.unshift('new-secret')
    try {
      const rotated = await getToken()
      expect(rotated.split('.')[2]).not.toBe(token.split('.')[2])
      keys.pop()
      // Without the old key, only the token signed with the new key works:
      await expectInvalid(token)
      expect((await confirmReset(rotated)).status).toBe(200)
    } finally {
      keys.splice(0, keys.length, 'test-secret')
    }
  })

  it('accepts tokens signed with older keys', async () => {
    const { keys } = app as { keys: string[] }
    const token = await getToken()
    keys.unshift('new-secret')
    try {
      expect((await confirmReset(token)).status).toBe(200)
    } finally {
      keys.splice(0, keys.length, 'test-secret')
    }
  })

  it('rejects tokens with unknown or invalid ids', async () => {
    const [, time, mac] = (await getToken()).split('.')
    for (const id of [`${member.id + 1}`, 'unknown', '']) {
      await expectInvalid(
        `${Buffer.from(id).toString('base64url')}.${time}.${mac}`
      )
    }
  })

  it('rejects tokens with tampered MACs or times', async () => {
    const token = await getToken()
    const [id, time, mac] = token.split('.')
    const tampered = `${mac[0] === 'a' ? 'b' : 'a'}${mac.slice(1)}`
    await expectInvalid(`${id}.${time}.${tampered}`)
    await expectInvalid(`${id}.${(parseInt(time, 36) + 1).toString(36)}.${mac}`)
    expect((await confirmReset(token)).status).toBe(200)
  })

  it('only accepts tokens for their user model', async () => {
    // With the same id as the member:
    const guest = await Guest.query().insert({
      id: member.id,
      username: 'ada',
      password: 'secret'
    } as any)
    await requestReset('ada', '/guests')
    const [{ url: link }] = sentResets
    const token = getLinkToken(link)
    const response = await confirmReset(token)
    expect(response.status).toBe(400)
    expect((await login('secret')).success).toBe(true)
    const stored = await Guest.query().findById(guest.id)
    expect(await stored!.$verifyPassword('secret')).toBe(true)
  })

  it('rejects tokens of users excluded by the session scope', async () => {
    const token = await getToken()
    await Member.query().patchById(member.id, { username: 'retired' })
    const response = await confirmReset(token)
    expect(response.status).toBe(400)
    expect(response.data.message).toBe('Invalid or expired token')
  })

  it('validates the new password and keeps the token', async () => {
    const token = await getToken()
    const response = await confirmReset(token, 'short')
    expect(response.status).toBe(400)
    expect(response.data.type).toBe('ModelValidation')
    expect((await confirmReset(token)).status).toBe(200)
  })

  it('ends the sessions of the user', async () => {
    const { request } = await login('secret')
    expect(await isAuthenticated(request)).toBe(true)
    await confirmReset(await getToken())
    expect(await isAuthenticated(request)).toBe(false)
  })

  it('keeps the session that resets the password', async () => {
    const { request } = await login('secret')
    const other = (await login('secret')).request
    await confirmReset(await getToken(), 'changed', request)
    expect(await isAuthenticated(request)).toBe(true)
    expect(await isAuthenticated(other)).toBe(false)
  })
})

describe('Password reset turned off', () => {
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

  it(`doesn't route the password reset actions`, async () => {
    await app.setup()
    for (const path of ['password-reset', 'password-reset-confirm']) {
      expect(app.router.find('POST', `/users/${path}`).handler).toBeUndefined()
    }
  })
})

describe('Password reset setup', () => {
  const setup = async (
    app: Record<string, any>,
    { isOverridden = true } = {}
  ) => {
    // Models are only set up once, so each app needs its own user model:
    class User extends UserModel {}
    class Users extends UsersController {
      override modelClass = User
    }
    class SendingUsers extends Users {
      override async sendPasswordReset() {}
    }
    const testApp = createTestApp({
      config: { app: { keys: ['test-secret'], ...app } },
      models: { User },
      controllers: { Users: isOverridden ? SendingUsers : Users }
    })
    try {
      await testApp.setup()
    } finally {
      await testApp.knex.destroy()
    }
  }

  const session = true
  const { passwordReset } = auth

  it('requires the keys', async () => {
    await expect(
      setup({ keys: undefined, session, auth: { passwordReset } })
    ).rejects.toThrow(`Unable to use password reset without 'app.keys'.`)
  })

  it('requires a confirm URL with a token', async () => {
    for (const confirmUrl of [undefined, 'https://example.com/admin/']) {
      await expect(
        setup({ session, auth: { ...auth, passwordReset: { confirmUrl } } })
      ).rejects.toThrow(
        `Invalid password reset, 'app.auth.passwordReset.confirmUrl' needs ` +
        `a '{token}' placeholder.`
      )
    }
  })

  it('requires sendPasswordReset() only where it is routed', async () => {
    class User extends UserModel {}
    class Users extends UsersController {
      override modelClass = User
      override async sendPasswordReset() {}
    }
    // Users that only log in, as `allow` doesn't route the password reset:
    class Admins extends UsersController {
      override modelClass = User
      override collection: any = {
        allow: ['post login', 'post logout', 'get session']
      }
    }
    const testApp = createTestApp({
      config: {
        app: { normalizePaths: true, keys: ['test-secret'], session, auth }
      },
      models: { User },
      controllers: { Users, Admins }
    })
    try {
      await testApp.setup()
      const findHandler = (path: string) =>
        testApp.router.find('POST', path).handler
      expect(findHandler('/users/password-reset')).toBeDefined()
      expect(findHandler('/admins/password-reset')).toBeUndefined()
    } finally {
      await testApp.knex.destroy()
    }
  })

  it('requires sendPasswordReset() to be overridden', async () => {
    await expect(
      setup({ session, auth }, { isOverridden: false })
    ).rejects.toThrow(
      `Unable to use password reset without overriding 'sendPasswordReset()'.`
    )
  })
})
