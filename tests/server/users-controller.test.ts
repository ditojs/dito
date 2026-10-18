import type { ModelProperties } from '@ditojs/server'
import bcrypt from 'bcryptjs'
import {
  Controller,
  SessionModel,
  UserModel,
  UsersController
} from '@ditojs/server'
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
        await ctx.login(await Member.authenticate(ctx))
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

// Sub-classes with their own `collection` inherit the authorization of the
// password, passkey and TOTP actions, also two levels deep:
class Writers extends UsersController {
  override modelClass = Member
  override collection: any = {
    allow: ['post login', 'post password']
  }
}

class SubReaders extends Readers {
  override collection: any = {
    allow: ['post login', 'post password']
  }
}

class SubWriters extends Writers {}

// Members whose patches need a role:
class Editors extends UsersController {
  override modelClass = Member
  override member: any = {
    allow: ['get', 'patch'],
    authorize: { patch: 'editor' }
  }
}

// Members whose graph patches answer without `hash`, as their scope omits it:
class Profiles extends UsersController {
  override modelClass = Member
  override scope = 'profile'
  override graph = true
  override member: any = {
    allow: ['patch']
  }
}

// Members that create, update and patch any member:
class Moderators extends UsersController {
  override modelClass = Member
  override collection: any = {
    allow: ['post', 'put', 'patch'],
    authorize: { post: true, put: true, patch: true }
  }

  override member: any = {
    allow: ['put', 'patch'],
    authorize: { put: true, patch: true }
  }
}

// Members that relate existing members when posting them with ids:
class Relaters extends UsersController {
  override modelClass = Member
  override relate = true
  override collection: any = {
    allow: ['post'],
    authorize: { post: true }
  }
}

// Members that delete themselves with confirmed access, as the docs show:
class Deleters extends UsersController {
  override modelClass = Member
  override member: any = {
    allow: ['delete'],
    authorize: {
      delete: (ctx: any) => this.hasConfirmedAccess(ctx) && '$self'
    }
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
      Writers,
      SubReaders,
      SubWriters,
      Editors,
      Profiles,
      Moderators,
      Relaters,
      Deleters
    }
  })

  let url: string
  let member: Member

  beforeAll(async () => {
    await createTestDatabase(app, Session, Member, Lead)
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

  it('compares passwords of unknown usernames too', async () => {
    // Spy on bcrypt, as the time of the comparison can't be measured reliably:
    const compare = vi.spyOn(bcrypt, 'compare')
    try {
      const login = async (username: unknown) => {
        compare.mockClear()
        const response = await createClient(url)('/members/login', {
          method: 'POST',
          body: { username, password: 'wrong' }
        })
        return { ...response, compared: compare.mock.calls.length }
      }
      const known = await login('ada')
      expect(known).toMatchObject({ status: 401, compared: 1 })
      expect(await login('unknown')).toEqual(known)
      expect(await login(['ada'])).toEqual(known)
    } finally {
      compare.mockRestore()
    }
  })

  it('rejects usernames that are not strings like unknown ones', async () => {
    for (const username of [['ada'], { username: 'ada' }]) {
      const login = await createClient(url)('/members/login', {
        method: 'POST',
        body: { username, password: 'secret' }
      })
      expect(login.status).toBe(401)
      expect(login.data.error).toBe('Password or username is incorrect')
    }
  })

  it('rejects passwords that are not strings like wrong ones', async () => {
    const request = createClient(url)
    const login = await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password: 123 }
    })
    expect(login.status).toBe(401)
    expect(login.data.error).toBe('Password or username is incorrect')
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

    it('ends sessions from before password fingerprints with password changes', async () => {
      const request = await loginOther()
      const [session] = await Session.query()
      await session.$query().patch({
        value: { passport: { user: `Member-${other.id}` } }
      } as any)
      // The first request adds the fingerprint:
      expect((await request('/members/session')).data.authenticated).toBe(true)
      await Member.query().patchById(other.id, { password: 'changed' } as any)
      await expectDroppedUser(request)
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

    it('keeps users who change their password', async () => {
      const other = await loginOther()
      const request = await loginOther()
      const response = await request('/members/self', {
        method: 'PATCH',
        body: { password: 'changed' }
      })
      expect(response.status).toBe(200)
      expect((await request('/members/session')).data.authenticated).toBe(true)
      expect((await other('/members/session')).data.authenticated).toBe(false)
    })

    it('ends the sessions of users whose password admins change', async () => {
      const request = await loginOther()
      const admin = createClient(url)
      await admin('/members/login', {
        method: 'POST',
        body: { username: 'ada', password: 'secret' }
      })
      const response = await admin(`/moderators/${other.id}`, {
        method: 'PATCH',
        body: { password: 'changed' }
      })
      expect(response.status).toBe(200)
      expect((await admin('/members/session')).data.authenticated).toBe(true)
      expect((await request('/members/session')).data.authenticated).toBe(false)
    })

    it('keeps users who change their password without their hash', async () => {
      const other = await loginOther()
      const request = await loginOther()
      const response = await request('/profiles/self', {
        method: 'PATCH',
        body: { password: 'changed' }
      })
      expect(response.status).toBe(200)
      expect(response.data).not.toHaveProperty('hash')
      expect((await request('/members/session')).data.authenticated).toBe(true)
      expect((await other('/members/session')).data.authenticated).toBe(false)
    })

    it(`doesn't keep sessions through other patches of the user`, async () => {
      const request = await loginOther()
      for (const path of ['/members/self', '/profiles/self']) {
        const response = await request(path, {
          method: 'PATCH',
          body: { nickname: 'Bobo' }
        })
        expect(response.status).toBe(200)
      }
      const other = await loginOther()
      const response = await other('/readers/password', {
        method: 'POST',
        body: { password: 'changed' }
      })
      expect(response.status).toBe(200)
      expect((await other('/members/session')).data.authenticated).toBe(true)
      expect((await request('/members/session')).data.authenticated).toBe(false)
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
        body: { nickname: 'Bobo' }
      })
      expect(self.status).toBe(200)
      expect(self.data).toMatchObject({ id: other.id, nickname: 'Bobo' })
      expect(self.data).not.toHaveProperty('hash')
      expect((await Member.query().findById(member.id))!.nickname).toBeNull()
    } finally {
      await Member.query().deleteById(other.id)
    }
  })

  it('only changes passwords with confirmed access', async () => {
    // Without a login, so without confirmed access:
    const request = createClient(url)
    for (const [path, method, body] of [
      [`/moderators/${member.id}`, 'PATCH', { password: 'changed' }],
      [`/moderators/${member.id}`, 'PUT', { username: 'ada', password: 'x' }],
      ['/moderators', 'PATCH', [{ id: member.id, password: 'changed' }]],
      ['/moderators', 'PUT', [{ id: member.id, password: 'changed' }]]
    ] as const) {
      const response = await request(path, { method, body })
      expect(response.status).toBe(403)
      expect(response.data.confirmationRequired).toBe(true)
    }
    const stored = (await Member.query().findById(member.id))!
    expect(await stored.$verifyPassword('secret')).toBe(true)
  })

  it('never sets the hash of the password directly', async () => {
    const request = createClient(url)
    await request('/members/login', {
      method: 'POST',
      body: { username: 'ada', password: 'secret' }
    })
    // A real hash, of the password 'changed':
    const { hash } = Member.fromJson({
      username: 'ada',
      password: 'changed'
    } as any)
    for (const [path, method, body] of [
      ['/members/self', 'PATCH', { hash }],
      [`/moderators/${member.id}`, 'PUT', { username: 'ada', hash }],
      ['/moderators', 'PATCH', [{ id: member.id, hash }]],
      ['/moderators', 'PUT', [{ id: member.id, hash }]],
      ['/moderators', 'POST', { username: 'cy', hash }]
    ] as const) {
      const response = await request(path, { method, body })
      expect(response.status).toBe(400)
      expect(response.data).toEqual({
        type: 'BodyValidation',
        message: `Unable to change 'hash', change 'password' instead`
      })
    }
    const stored = (await Member.query().findById(member.id))!
    expect(await stored.$verifyPassword('secret')).toBe(true)
    expect(await Member.query().findOne('username', 'cy')).toBeUndefined()
  })

  it('validates related users with ids like updates', async () => {
    // Without a login, so without confirmed access:
    const request = createClient(url)
    for (const [body, status] of [
      [{ id: member.id, hash: 'pwned' }, 400],
      [{ id: member.id, password: 'changed' }, 403],
      [{ id: member.id, username: 'eve' }, 403]
    ] as const) {
      const response = await request('/relaters', { method: 'POST', body })
      expect(response.status).toBe(status)
    }
    const stored = (await Member.query().findById(member.id))!
    expect(stored.username).toBe('ada')
    expect(await stored.$verifyPassword('secret')).toBe(true)
  })

  it('only lets users delete themselves with confirmed access', async () => {
    const [cy, dee] = await Promise.all(
      ['cy', 'dee'].map(username =>
        Member.query().insert({ username, password: 'secret' } as any)
      )
    )
    try {
      const request = createClient(url)
      await request('/members/login', {
        method: 'POST',
        body: { username: 'cy', password: 'secret' }
      })
      const other = await request(`/deleters/${dee.id}`, { method: 'DELETE' })
      expect(other.status).toBe(401)
      const self = await request('/deleters/self', { method: 'DELETE' })
      expect(self.status).toBe(200)
      expect(await Member.query().findById(cy.id)).toBeUndefined()
      expect(await Member.query().findById(dee.id)).toBeDefined()
    } finally {
      await Member.query().whereIn('id', [cy.id, dee.id]).delete()
    }
  })

  it('creates users with passwords', async () => {
    const request = createClient(url)
    const response = await request('/moderators', {
      method: 'POST',
      body: { username: 'cy', password: 'secret' }
    })
    expect(response.status).toBe(201)
    try {
      const login = await createClient(url)('/members/login', {
        method: 'POST',
        body: { username: 'cy', password: 'secret' }
      })
      expect(login.data.success).toBe(true)
    } finally {
      await Member.query().deleteById(response.data.id)
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
    const changePassword = async (
      body: Record<string, unknown>,
      path = 'readers'
    ) => {
      const request = createClient(url)
      await request(`/${path}/login`, {
        method: 'POST',
        body: { username: 'ada', password: 'secret' }
      })
      return request(`/${path}/password`, { method: 'POST', body })
    }

    const isPassword = async (password: string) =>
      (await Member.query().findById(member.id))!.$verifyPassword(password)

    afterEach(async () => {
      await Member.query().patchById(member.id, { password: 'secret' } as any)
    })

    it('changes the password of the user', async () => {
      const response = await changePassword({ password: 'changed' })
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ success: true })
      expect(await isPassword('changed')).toBe(true)
    })

    it.each(['writers', 'sub-readers', 'sub-writers'])(
      'changes the password through the sub-class at /%s',
      async path => {
        const response = await changePassword({ password: 'changed' }, path)
        expect(response.status).toBe(200)
        expect(await isPassword('changed')).toBe(true)
      }
    )

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
        body: { password: 'changed' }
      })
      expect(response.status).toBe(200)
      expect((await request('/readers/session')).data.authenticated).toBe(true)
      expect((await other('/readers/session')).data.authenticated).toBe(false)
    })

    it('validates the new password', async () => {
      for (const [body, type] of [
        [{}, 'ParameterValidation'],
        [{ password: 'short' }, 'ModelValidation']
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
        body: { password: 'changed' }
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

// Sessions that only count visits, stored in the cookie:
class Visits extends Controller {
  override actions: any = {
    'post .'(ctx: any) {
      ctx.session.visits = (ctx.session.visits ?? 0) + 1
      return { visits: ctx.session.visits }
    }
  }
}

describe('Session cookie', () => {
  const getSetCookies = async (session: Record<string, any>) => {
    const app = createTestApp({
      config: {
        app: { normalizePaths: true, keys: ['test-secret'], session }
      },
      controllers: { Visits }
    })
    await app.start()
    try {
      const response = await fetch(`${getAppUrl(app)}/visits`, {
        method: 'POST'
      })
      expect(response.status).toBe(200)
      return response.headers.getSetCookie()
    } finally {
      await app.stop()
      await app.knex.destroy()
    }
  }

  it.each([
    [{}, '; samesite=lax'],
    [{ sameSite: 'strict' }, '; samesite=strict'],
    [{ sameSite: 'none' }, '; samesite=none']
  ])('sets sameSite with %o', async (session, attribute) => {
    const cookies = await getSetCookies(session)
    expect(cookies).not.toEqual([])
    for (const cookie of cookies) {
      expect(cookie).toContain(attribute)
    }
  })
})

describe('UsersController setup', () => {
  it('requires sessions', async () => {
    class User extends UserModel {}
    class Users extends UsersController {
      override modelClass = User
    }
    const app = createTestApp({
      config: { app: { keys: ['test-secret'] } },
      models: { User },
      controllers: { Users }
    })
    try {
      await expect(app.setup()).rejects.toThrow(
        `Unable to log in users without sessions, see 'app.session'.`
      )
    } finally {
      await app.knex.destroy()
    }
  })
})
