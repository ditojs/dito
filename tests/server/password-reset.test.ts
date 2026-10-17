import type { ModelProperties } from '@ditojs/server'
import {
  CredentialModel,
  SessionModel,
  UserModel,
  UsersController
} from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createClient } from '../utils/client.js'
import { createTestDatabase } from '../utils/database.js'

const sentResets: { user: string; url: string }[] = []
// Whether the request still had its transaction when sending:
const sendTransactions: boolean[] = []

const getLinkToken = (link: string) =>
  new URLSearchParams(new URL(link).hash.slice(1)).get('password-reset')!

class Session extends SessionModel {
  declare value: Record<string, any>
}

class Credential extends CredentialModel {
  declare id: number
  declare type: string
  declare userModel: string
  declare userId: string
  declare key: string | null
}

class Member extends UserModel {
  declare id: number
  declare username: string

  static override options = {
    sessionScope: 'current'
  }

  static override properties: ModelProperties = {
    password: {
      type: 'string',
      computed: true,
      minLength: 6
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

  // Not async, so that its errors are thrown right away:
  override sendPasswordReset(ctx: any, user: Member, url: string) {
    if (user.username === 'broken') {
      throw new Error('Unable to send')
    }
    sentResets.push({ user: user.username, url })
    sendTransactions.push(!!ctx.transaction)
  }
}

// Members whose password reset runs in a transaction, which fails on request:
class TransactedMembers extends Members {
  override collection: any = {
    'post password-reset': {
      transacted: true,
      async handler(ctx: any) {
        const result = await super['post password-reset'](ctx)
        if (ctx.request.body.fail) {
          throw new Error('Failed')
        }
        return result
      }
    }
  }
}

class Guests extends UsersController {
  override modelClass = Guest

  override async sendPasswordReset(ctx: any, user: Guest, url: string) {
    sentResets.push({ user: 'guest', url })
  }
}

const auth = {
  credentials: { modelClass: 'Credential', secret: 'credentials-secret' },
  passwordReset: {
    confirmUrl: 'https://example.com/admin/#password-reset={token}',
    expires: '30m'
  }
}

describe('Password reset', () => {
  const app = createTestApp({
    config: {
      app: {
        normalizePaths: true,
        helmet: false,
        keys: ['test-secret'],
        session: { modelClass: 'Session' },
        auth
      }
    },
    models: { Session, Credential, Member, Guest },
    controllers: { Members, Guests, TransactedMembers }
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

  // Request a reset for ada, and return the token of the sent link:
  const getToken = async () => {
    await requestReset()
    const [{ url }] = sentResets.splice(0)
    return getLinkToken(url)
  }

  const confirmReset = async (
    token: string,
    password = 'changed',
    request = createClient(url)
  ) =>
    request('/members/password-reset-confirm', {
      method: 'POST',
      body: { token, password }
    })

  const login = async (password: string) => {
    const request = createClient(url)
    const response = await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password }
    })
    return { request, success: response.data.success }
  }

  const isAuthenticated = async (request: ReturnType<typeof createClient>) =>
    (await request('/members/session')).data.authenticated

  // Move the creation of ada's tokens back in time:
  const ageTokens = (milliseconds: number) =>
    Credential.query()
      .where('type', 'password-reset')
      .patch({ createdAt: new Date(Date.now() - milliseconds) } as any)

  beforeAll(async () => {
    await createTestDatabase(app, Session, Member, Guest, Credential)
    for (const table of ['Member', 'Guest']) {
      await app.knex.schema.alterTable(table, table => {
        table.dropColumn('password')
      })
    }
    await app.start()
    url = getAppUrl(app)
  })

  beforeEach(async () => {
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
    sentResets.length = 0
    sendTransactions.length = 0
    await app.knex('Session').del()
    await app.knex('Credential').del()
    await app.knex('Member').del()
    await app.knex('Guest').del()
  })

  it('sends a link with a token, stored hashed', async () => {
    const response = await requestReset()
    expect(response.status).toBe(200)
    expect(response.data).toEqual({ success: true })
    expect(sentResets).toEqual([
      {
        user: 'ada',
        url: expect.stringMatching(
          /^https:\/\/example\.com\/admin\/#password-reset=[\w-]{43}$/
        )
      }
    ])
    const token = getLinkToken(sentResets[0].url)
    const credentials = await Credential.query()
    expect(credentials).toEqual([
      expect.objectContaining({
        type: 'password-reset',
        userModel: 'Member',
        userId: `${member.id}`
      })
    ])
    expect(credentials[0].key).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(credentials)).not.toContain(token)
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

  it('sends one link for concurrent requests', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => requestReset())
    )
    expect(responses.map(({ status }) => status)).toEqual(Array(5).fill(200))
    expect(sentResets).toHaveLength(1)
    expect(await Credential.query()).toHaveLength(1)
  })

  it('sends links once the transaction of the request commits', async () => {
    const response = await requestReset('ada', '/transacted-members')
    expect(response.status).toBe(200)
    expect(sentResets).toHaveLength(1)
    expect(sendTransactions).toEqual([false])
    // Requests that roll back don't send their links:
    await ageTokens(61 * 1000)
    const failed = await requestReset(
      { username: 'ada', fail: true },
      '/transacted-members'
    )
    expect(failed.status).toBe(500)
    expect(sentResets).toHaveLength(1)
  })

  it('sends at most one link a minute', async () => {
    await requestReset()
    const response = await requestReset()
    expect(response.data).toEqual({ success: true })
    expect(sentResets).toHaveLength(1)
    await ageTokens(61 * 1000)
    await requestReset()
    expect(sentResets).toHaveLength(2)
  })

  it('cleans up expired tokens with new ones', async () => {
    await requestReset()
    await ageTokens(31 * 60 * 1000)
    await requestReset()
    expect(await Credential.query()).toHaveLength(1)
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
    const response = await confirmReset(token, 'another')
    expect(response.status).toBe(400)
    expect(response.data.message).toBe('Invalid or expired token')
    expect((await login('changed')).success).toBe(true)
  })

  it('deletes all tokens of the user with the reset', async () => {
    const first = await getToken()
    await ageTokens(61 * 1000)
    const second = await getToken()
    expect((await confirmReset(second)).status).toBe(200)
    expect((await confirmReset(first, 'another')).status).toBe(400)
    expect(await Credential.query()).toEqual([])
  })

  it('deletes the tokens of the user with password changes', async () => {
    const token = await getToken()
    const { request } = await login('secret')
    const response = await request('/members/password', {
      method: 'POST',
      body: { currentPassword: 'secret', password: 'changed' }
    })
    expect(response.status).toBe(200)
    expect(await Credential.query()).toEqual([])
    expect((await confirmReset(token, 'another')).status).toBe(400)
  })

  it('rejects expired tokens', async () => {
    const token = await getToken()
    await ageTokens(31 * 60 * 1000)
    const response = await confirmReset(token)
    expect(response.status).toBe(400)
    expect(response.data.message).toBe('Invalid or expired token')
    expect((await login('secret')).success).toBe(true)
  })

  it('rejects unknown tokens', async () => {
    const response = await confirmReset('unknown')
    expect(response.status).toBe(400)
    expect(response.data.message).toBe('Invalid or expired token')
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
      models: { Session, Credential, User },
      controllers: { Users: isOverridden ? SendingUsers : Users }
    })
    try {
      await testApp.setup()
    } finally {
      await testApp.knex.destroy()
    }
  }

  const session = { modelClass: 'Session' }
  const { passwordReset } = auth

  it('requires sessions stored on the server', async () => {
    await expect(setup({ session: true, auth })).rejects.toThrow(
      `Unable to use password reset without sessions stored on the server, ` +
      `see 'app.session'.`
    )
  })

  it('requires the secret of the credentials', async () => {
    await expect(
      setup({
        session,
        auth: { credentials: { modelClass: 'Credential' }, passwordReset }
      })
    ).rejects.toThrow(
      `Unable to use password reset without 'app.auth.credentials.secret'.`
    )
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
      models: { Session, Credential, User },
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
