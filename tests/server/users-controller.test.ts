import type { ModelProperties } from '@ditojs/server'
import { SessionModel, UserModel, UsersController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createClient } from '../utils/client.js'
import { createTestDatabase } from '../utils/database.js'
import { isSQLiteTest } from '../utils/test-knex.js'

const loginEvents: string[] = []
const patchTransactions: boolean[] = []

class Session extends SessionModel {}

class Member extends UserModel {
  declare id: number
  declare username: string
  declare nickname: string | null

  static override options = {
    sessionScope: 'current'
  }

  static override properties: ModelProperties = {
    nickname: {
      type: 'string'
    },

    password: {
      type: 'string',
      computed: true,
      minLength: 6
    }
  }

  static override scopes = {
    current: (query: any) => query.whereNot('username', 'retired'),
    profile: (query: any) => query.select('id', 'username', 'nickname')
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

// Dito gives subclasses their own tables, so their ids overlap with members:
class Lead extends Member {}

class Members extends UsersController {
  override modelClass = Member

  override collection: any = {
    // Keep the inherited login actions and add the default `get` action.
    'allow': [
      'get',
      'post login',
      'post logout',
      'get session',
      'get self',
      'post broken-login'
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
    },

    // Fail after logging in, to roll back the session with the transaction:
    'post broken-login': {
      transacted: true,
      async handler(ctx: any) {
        await Member.login(ctx)
        throw new Error('Login is broken')
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

// Members whose patches answer without `hash`, as their scope omits it:
class Profiles extends UsersController {
  override modelClass = Member
  override scope = 'profile'
  override member: any = {
    allow: ['patch']
  }
}

// Members that patch any member, also their password:
class Moderators extends UsersController {
  override modelClass = Member
  override member: any = {
    allow: ['patch'],
    authorize: { patch: true }
  }
}

class Leads extends UsersController {
  override modelClass = Lead
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
        }
      }
    },
    models: { Session, Member, Lead },
    controllers: {
      Members,
      Leads,
      Admins,
      Readers,
      Editors,
      Profiles,
      Moderators
    }
  })

  let url: string
  let member: Member

  beforeAll(async () => {
    await createTestDatabase(app, Member, Lead)
    // Session ids are strings, not auto-incrementing integers.
    await app.knex.schema.createTable('Session', table => {
      table.string('id').primary()
      table.jsonb('value')
    })
    // The computed `password` property isn't stored in the database.
    for (const name of ['Member', 'Lead']) {
      await app.knex.schema.alterTable(name, table => {
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
  })

  it('reports unauthenticated sessions', async () => {
    const request = createClient(url)
    expect((await request('/members/session')).data).toEqual({
      authenticated: false,
      user: null
    })
    const self = await request('/members/self')
    expect(self.status).toBe(204)
    expect(self.data).toBeNull()
  })

  it('logs in members and persists the session in the database', async () => {
    const request = createClient(url)
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
    const request = createClient(url)
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
    const request = createClient(url)
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
      const request = createClient(url)
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
    const request = createClient(url)
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
      const request = createClient(url)
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
    const request = createClient(url)
    await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    loginEvents.length = 0
    const logout = await request('/members/logout', { method: 'POST' })
    expect(logout.data).toEqual({ success: true, authenticated: false })
    expect(loginEvents).toEqual(['before logout ada', 'after logout ada'])
    expect(await Session.query()).toEqual([])
    expect((await request('/members/session')).data.authenticated).toBe(false)
  })

  it('regenerates the session id on login', async () => {
    const request = createClient(url)
    const credentials = { username: 'ada', password: 'secret' }
    await request('/members/login', { method: 'POST', body: credentials })
    const [before] = await Session.query()
    await request('/members/login', { method: 'POST', body: credentials })
    const sessions = await Session.query()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).not.toBe(before.id)
  })

  it('does not read credentials from the query string', async () => {
    const request = createClient(url)
    const login = await request('/members/login?username=ada&password=secret', {
      method: 'POST',
      body: {}
    })
    expect(login.status).toBe(400)
    expect(login.data.error).toBe('Missing credentials')
  })

  it('leaves no session behind when a transacted login fails', async () => {
    const request = createClient(url)
    const login = await request('/members/broken-login', {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    expect(login.status).toBe(500)
    expect(await Session.query()).toEqual([])
    expect((await request('/members/session')).data.authenticated).toBe(false)
  })

  describe('session users', () => {
    let other: Member

    beforeEach(async () => {
      other = await Member.query().insert({
        username: 'bo',
        password: 'secret'
      } as any)
    })

    afterEach(async () => {
      await Member.query().deleteById(other.id)
    })

    const loginOther = async () => {
      const request = createClient(url)
      await request('/members/login', {
        method: 'POST',
        body: { username: 'bo', password: 'secret' }
      })
      expect((await request('/members/session')).data.authenticated).toBe(true)
      return request
    }

    const expectDroppedUser = async (request: any) => {
      expect((await request('/members/session')).data.authenticated).toBe(false)
      const [session] = await Session.query()
      expect(session.value.passport).toBeUndefined()
    }

    it('drops users excluded by the session scope', async () => {
      const request = await loginOther()
      await Member.query().patchById(other.id, { username: 'retired' })
      await expectDroppedUser(request)
    })

    it('drops users that no longer exist', async () => {
      const request = await loginOther()
      await Member.query().deleteById(other.id)
      await expectDroppedUser(request)
    })

    it('drops users whose password changed', async () => {
      const request = await loginOther()
      await Member.query().patchById(other.id, { password: 'changed' } as any)
      await expectDroppedUser(request)
    })

    it('keeps sessions from before password fingerprints', async () => {
      const request = await loginOther()
      const [session] = await Session.query()
      await session.$query().patch({
        value: { passport: { user: `Member-${other.id}` } }
      } as any)
      await Member.query().patchById(other.id, { password: 'changed' } as any)
      expect((await request('/members/session')).data.authenticated).toBe(true)
    })

    it('keeps users patched without their hash', async () => {
      const request = await loginOther()
      const response = await request('/profiles/self', {
        method: 'PATCH',
        body: { nickname: 'Bobo' }
      })
      expect(response.status).toBe(200)
      expect((await request('/members/session')).data.authenticated).toBe(true)
    })

    it(`keeps the session that changes others' passwords`, async () => {
      const request = createClient(url)
      await request('/members/login', {
        method: 'POST',
        body: { username: 'ada', password: 'secret' }
      })
      const response = await request(`/moderators/${other.id}`, {
        method: 'PATCH',
        body: { password: 'changed' }
      })
      expect(response.status).toBe(200)
      expect((await request('/members/session')).data).toMatchObject({
        authenticated: true,
        user: { id: member.id }
      })
    })

    it('passes on errors of the session query', async context => {
      context.skip(isSQLiteTest, 'SQLite compares text with integer ids')
      const request = await loginOther()
      await Session.query().patch({
        value: { passport: { user: 'Member-not-a-number' } }
      } as any)
      expect((await request('/members/session')).status).toBe(400)
    })
  })

  it('only authenticates users of its own model class', async () => {
    const lead = await Lead.query().insert({
      id: member.id,
      username: 'lea',
      password: 'secret'
    } as any)
    try {
      const request = createClient(url)
      await request('/leads/login', {
        method: 'POST',
        body: { username: 'lea', password: 'secret' }
      })
      expect((await request('/leads/session')).data).toMatchObject({
        authenticated: true,
        user: { id: lead.id, username: 'lea' }
      })
      expect((await request('/members/session')).data).toEqual({
        authenticated: false,
        user: null
      })
      expect((await request('/members/self')).status).toBe(204)
    } finally {
      await Lead.query().deleteById(lead.id)
    }
  })

  it('does not log out unauthenticated requests', async () => {
    const request = createClient(url)
    const logout = await request('/members/logout', { method: 'POST' })
    expect(logout.data).toEqual({ success: false, authenticated: false })
  })

  it('only allows members to access themselves', async () => {
    const other = await Member.query().insert({
      username: 'bo',
      password: 'secret'
    } as any)
    const request = createClient(url)
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
    const request = createClient(url)
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
      const request = createClient(url)
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
      // Changing the own password keeps the session:
      expect((await request('/members/session')).data.authenticated).toBe(true)
      // The password is hashed like in other patches:
      const login = await createClient(url)('/members/login', {
        method: 'POST',
        body: { username: 'bo', password: 'changed' }
      })
      expect(login.data.success).toBe(true)
    } finally {
      await Member.query().deleteById(other.id)
    }
  })

  it('validates the patches of members', async () => {
    const request = createClient(url)
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
    const request = createClient(url)
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
      const request = createClient(url)
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

  describe('password changes', () => {
    const changePassword = async (body: Record<string, unknown>) => {
      const request = createClient(url)
      await request('/readers/login', {
        method: 'POST',
        body: { username: 'ada', password: 'secret' }
      })
      return request('/readers/password', { method: 'POST', body })
    }

    const isPassword = async (password: string) =>
      (await Member.query().findById(member.id))!.$verifyPassword(password)

    afterEach(async () => {
      await Member.query().patchById(member.id, { password: 'secret' } as any)
    })

    it('changes the password of the user', async () => {
      const response = await changePassword({
        currentPassword: 'secret',
        password: 'changed'
      })
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ success: true })
      expect(await isPassword('changed')).toBe(true)
    })

    it('ends the other sessions of the user, but not its own', async () => {
      const other = createClient(url)
      await other('/readers/login', {
        method: 'POST',
        body: { username: 'ada', password: 'secret' }
      })
      expect((await other('/readers/session')).data.authenticated).toBe(true)
      const request = createClient(url)
      await request('/readers/login', {
        method: 'POST',
        body: { username: 'ada', password: 'secret' }
      })
      const response = await request('/readers/password', {
        method: 'POST',
        body: { currentPassword: 'secret', password: 'changed' }
      })
      expect(response.status).toBe(200)
      expect((await request('/readers/session')).data.authenticated).toBe(true)
      expect((await other('/readers/session')).data.authenticated).toBe(false)
    })

    it('rejects wrong current passwords', async () => {
      const response = await changePassword({
        currentPassword: 'wrong',
        password: 'changed'
      })
      expect(response.status).toBe(400)
      expect(response.data).toEqual({ message: 'Password is incorrect' })
      expect(await isPassword('secret')).toBe(true)
    })

    it('validates the new password', async () => {
      for (const [body, type] of [
        [{ currentPassword: 'secret' }, 'ParameterValidation'],
        [{ currentPassword: 'secret', password: 'short' }, 'ModelValidation']
      ] as const) {
        const response = await changePassword(body)
        expect(response.status).toBe(400)
        expect(response.data.type).toBe(type)
      }
      expect(await isPassword('secret')).toBe(true)
    })

    it('rejects password changes without a login', async () => {
      const response = await createClient(url)('/readers/password', {
        method: 'POST',
        body: { currentPassword: 'secret', password: 'changed' }
      })
      expect(response.status).toBe(401)
      expect(await isPassword('secret')).toBe(true)
    })
  })

  it(`doesn't apply the controller's authorize to logins and sessions`, async () => {
    const request = createClient(url)
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
