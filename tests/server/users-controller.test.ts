import type { ModelProperties } from '@ditojs/server'
import { SessionModel, UserModel, UsersController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

const loginEvents: string[] = []
const patchTransactions: boolean[] = []

class Session extends SessionModel {}

class Member extends UserModel {
  declare id: number
  declare username: string
  declare nickname: string | null

  static override properties: ModelProperties = {
    nickname: {
      type: 'string'
    }
  }

  static override hooks: any = {
    'before:login'(member: Member) {
      if (member.username === 'locked') {
        throw new Error('Account is locked')
      }
      loginEvents.push(`before login ${member.username}`)
    },
    'after:login'(member: Member) {
      loginEvents.push(`after login ${member.username}`)
    },
    'before:logout'(member: Member) {
      loginEvents.push(`before logout ${member.username}`)
    },
    'after:logout'(member: Member) {
      loginEvents.push(`after logout ${member.username}`)
    }
  }
}

class Members extends UsersController {
  override modelClass = Member

  override collection: any = {
    // Keep the inherited login actions and add the default `get` action.
    'allow': [
      'get',
      'post login',
      'post logout',
      'get session',
      'get self'
    ],
    'authorize': {
      get: true
    },

    // Wrap the inherited action, to log in within a transaction. The session
    // is then only committed after the action succeeded.
    'post login': {
      transacted: true,
      async handler(ctx: any) {
        const response = await super['post login'](ctx)
        return { ...response, transacted: !!ctx.transaction }
      }
    }
  }

  // Inherits `authorize: ['$self']` from `UsersController`.
  override member: any = {
    allow: ['get', 'patch'],

    // Record whether patches run in a transaction, also through `self`:
    patch: {
      transacted: true,
      handler(ctx: any, modify: any) {
        patchTransactions.push(!!ctx.transaction)
        return super.patch(ctx, modify)
      }
    }
  }
}

// Members that can't patch themselves, as \`allow\` doesn't route \`patch\`:
class Readers extends UsersController {
  override modelClass = Member
}

// Members whose patches need a role:
class Editors extends UsersController {
  override modelClass = Member
  override member: any = {
    allow: ['get', 'patch'],
    authorize: { patch: 'editor' }
  }
}

// Users that only admins may access, while anyone can log in and out:
class Admins extends UsersController {
  override modelClass = Member
  override authorize = 'admin'
}

describe('UsersController', () => {
  const app = createTestApp({
    config: {
      app: {
        normalizePaths: true,
        helmet: false,
        keys: ['test-secret'],
        session: {
          modelClass: 'Session'
        },
        passport: true
      }
    },
    models: { Session, Member },
    controllers: { Members, Admins, Readers, Editors }
  })

  let url: string
  let member: Member

  // A minimal cookie jar, to keep the session between requests.
  const createClient = () => {
    const cookies = new Map<string, string>()
    return async (
      path: string,
      { method = 'GET', body }: { method?: string; body?: any } = {}
    ) => {
      const response = await fetch(`${url}${path}`, {
        method,
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'cookie': [...cookies]
            .map(([key, value]) => `${key}=${value}`)
            .join('; ')
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
      })
      for (const cookie of response.headers.getSetCookie()) {
        const [, key, value] = cookie.match(/^([^=]+)=([^;]*)/) ?? []
        if (value) {
          cookies.set(key, value)
        } else {
          cookies.delete(key)
        }
      }
      const isJson = response.headers.get('content-type')?.includes('json')
      return {
        status: response.status,
        data: isJson ? await response.json() : null
      }
    }
  }

  beforeAll(async () => {
    await createTestDatabase(app, Member)
    // Session ids are strings, not auto-incrementing integers.
    await app.knex.schema.createTable('Session', table => {
      table.string('id').primary()
      table.jsonb('value')
    })
    // The computed `password` property isn't stored in the database.
    await app.knex.schema.alterTable('Member', table => {
      table.dropColumn('password')
    })
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
  })

  it('reports unauthenticated sessions', async () => {
    const request = createClient()
    expect((await request('/members/session')).data).toEqual({
      authenticated: false,
      user: null
    })
    const self = await request('/members/self')
    expect(self.status).toBe(204)
    expect(self.data).toBeNull()
  })

  it('logs in members and persists the session in the database', async () => {
    const request = createClient()
    const login = await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    expect(login.status).toBe(200)
    expect(login.data).toMatchObject({
      success: true,
      authenticated: true,
      transacted: true,
      user: { id: member.id, username: 'ada' }
    })
    expect(login.data.user).not.toHaveProperty('hash')
    expect(loginEvents).toEqual(['before login ada', 'after login ada'])

    const [session] = await Session.query()
    expect(session.value).toMatchObject({
      passport: { user: `Member-${member.id}` }
    })
    const updated = await Member.query().findById(member.id)
    expect((updated as any).lastLogin).toBeInstanceOf(Date)
  })

  it('restores the user from the session in later requests', async () => {
    const request = createClient()
    await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    expect((await request('/members/session')).data).toMatchObject({
      authenticated: true,
      user: { id: member.id, username: 'ada' }
    })
    expect((await request('/members/self')).data).toMatchObject({
      id: member.id,
      username: 'ada'
    })
  })

  it('rejects logins with wrong passwords', async () => {
    const request = createClient()
    const login = await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password: 'wrong' }
    })
    expect(login.status).toBe(401)
    expect(login.data).toEqual({
      success: false,
      authenticated: false,
      transacted: true,
      user: null,
      error: 'Password or username is incorrect'
    })
    expect(loginEvents).toEqual([])
    expect((await request('/members/session')).data.authenticated).toBe(false)
  })

  it('rejects logins of members without a password', async () => {
    const invited = await Member.query().insert({ username: 'invited' } as any)
    try {
      const request = createClient()
      const login = await request('/members/login', {
        method: 'POST',
        body: { username: 'invited', password: 'secret' }
      })
      expect(login.status).toBe(401)
      expect(login.data.error).toBe('Password or username is incorrect')
    } finally {
      await Member.query().deleteById(invited.id)
    }
  })

  it('rejects logins with missing credentials', async () => {
    const request = createClient()
    const login = await request('/members/login', {
      method: 'POST',
      body: {}
    })
    expect(login.status).toBe(400)
    expect(login.data).toMatchObject({
      success: false,
      error: 'Missing credentials'
    })
  })

  it('rejects logins that fail without a status with 401', async () => {
    const locked = await Member.query().insert({
      username: 'locked',
      password: 'secret'
    } as any)
    try {
      const request = createClient()
      const login = await request('/members/login', {
        method: 'POST',
        body: { username: 'locked', password: 'secret' }
      })
      expect(login.status).toBe(401)
      expect(login.data).toMatchObject({
        success: false,
        user: null,
        error: 'Account is locked'
      })
    } finally {
      await Member.query().deleteById(locked.id)
    }
  })

  it('logs out members and clears the session', async () => {
    const request = createClient()
    await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    loginEvents.length = 0
    const logout = await request('/members/logout', { method: 'POST' })
    expect(logout.data).toEqual({ success: true, authenticated: false })
    expect(loginEvents).toEqual(['before logout ada', 'after logout ada'])
    expect((await request('/members/session')).data.authenticated).toBe(false)
  })

  it('does not log out unauthenticated requests', async () => {
    const request = createClient()
    const logout = await request('/members/logout', { method: 'POST' })
    expect(logout.data).toEqual({ success: false, authenticated: false })
  })

  it('only allows members to access themselves', async () => {
    const other = await Member.query().insert({
      username: 'bo',
      password: 'secret'
    } as any)
    const request = createClient()
    expect((await request(`/members/${member.id}`)).status).toBe(401)
    await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    expect((await request(`/members/${member.id}`)).status).toBe(200)
    expect((await request(`/members/${other.id}`)).status).toBe(401)
    await Member.query().deleteById(other.id)
  })

  it('patches members through `self` with the settings of `patch`', async () => {
    const request = createClient()
    await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    patchTransactions.length = 0
    const self = await request('/members/self', {
      method: 'PATCH',
      body: { username: 'ada' }
    })
    expect(self.status).toBe(200)
    expect(patchTransactions).toEqual([true])
  })

  it('lets members patch themselves', async () => {
    const other = await Member.query().insert({
      username: 'bo',
      password: 'secret'
    } as any)
    try {
      const request = createClient()
      await request('/members/login', {
        method: 'POST',
        body: { username: 'bo', password: 'secret' }
      })
      const self = await request('/members/self', {
        method: 'PATCH',
        body: { nickname: 'Bobo', password: 'changed' }
      })
      expect(self.status).toBe(200)
      expect(self.data).toMatchObject({ id: other.id, nickname: 'Bobo' })
      expect(self.data).not.toHaveProperty('hash')
      expect((await Member.query().findById(member.id))!.nickname).toBeNull()
      // The password is hashed like in other patches:
      const login = await createClient()('/members/login', {
        method: 'POST',
        body: { username: 'bo', password: 'changed' }
      })
      expect(login.data.success).toBe(true)
    } finally {
      await Member.query().deleteById(other.id)
    }
  })

  it('validates the patches of members', async () => {
    const request = createClient()
    await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    const self = await request('/members/self', {
      method: 'PATCH',
      body: { nickname: 1 }
    })
    expect(self.status).toBe(400)
    expect(self.data).toMatchObject({
      type: 'ModelValidation',
      errors: { nickname: [{ keyword: 'type' }] }
    })
    expect((await Member.query().findById(member.id))!.nickname).toBeNull()
  })

  it('rejects patches of the user without a login', async () => {
    const request = createClient()
    const self = await request('/members/self', {
      method: 'PATCH',
      body: { nickname: 'Anonymous' }
    })
    expect(self.status).toBe(401)
  })

  it(`only lets members patch themselves like their member`, async () => {
    for (const [path, status] of [
      ['readers', 405],
      ['editors', 401]
    ] as const) {
      const request = createClient()
      await request(`/${path}/login`, {
        method: 'POST',
        body: { username: 'ada', password: 'secret' }
      })
      const self = await request(`/${path}/self`, {
        method: 'PATCH',
        body: { nickname: 'Countess' }
      })
      // Without a routed `patch`, `self` has no member route to go to:
      expect(self.status).toBe(status)
    }
    expect((await Member.query().findById(member.id))!.nickname).toBeNull()
  })

  it(`doesn't apply the controller's authorize to logins and sessions`, async () => {
    const request = createClient()
    const login = await request('/admins/login', {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    expect(login.status).toBe(200)
    expect(login.data.success).toBe(true)
    const session = await request('/admins/session')
    expect(session.status).toBe(200)
    expect(session.data.authenticated).toBe(true)
    // `self` returns the user like the member route, which needs the role:
    expect((await request('/admins/self')).status).toBe(401)
    const logout = await request('/admins/logout', { method: 'POST' })
    expect(logout.data).toEqual({ success: true, authenticated: false })
  })
})
