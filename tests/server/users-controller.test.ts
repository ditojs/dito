import type { ModelProperties } from '@ditojs/server'
import { SessionModel, UserModel, UsersController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

const loginEvents: string[] = []

class Session extends SessionModel {}

class Member extends UserModel {
  declare id: number
  declare username: string

  static override properties: ModelProperties = {
    nickname: {
      type: 'string'
    }
  }

  static override hooks: any = {
    'before:login'(member: Member) {
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
    'allow': ['get', 'post login', 'post logout', 'get session', 'get self'],
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
    allow: ['get']
  }
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
    controllers: { Members }
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
      const text = await response.text()
      return { status: response.status, data: text ? JSON.parse(text) : null }
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
})
