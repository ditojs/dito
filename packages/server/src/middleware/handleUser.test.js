import { createTestKnex } from '../../../../tests/utils/test-knex.ts'
import { Application } from '../app/Application.js'
import { Controller } from '../controllers/index.js'
import { Model, UserModel } from '../models/index.js'

const uuid = '4b0b6f1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b'
const goneId = '00000000-0000-4000-8000-000000000000'
const passwordId = '9c8b7a6f-5e4d-4c3b-8a2f-1e0d9c8b7a6f'
const events = []

class Reader extends UserModel {
  static properties = {
    id: {
      type: 'string',
      format: 'uuid',
      primary: true
    }
  }

  static hooks = {
    'before:login'(reader, options) {
      events.push(`before:login ${reader.id} ${JSON.stringify(options)}`)
    },
    'after:login'(reader) {
      events.push(`after:login ${reader.id}`)
    },
    'before:logout'(reader) {
      events.push(`before:logout ${reader.id}`)
    },
    'after:logout'(reader) {
      events.push(`after:logout ${reader.id}`)
    }
  }
}

class KeyedReader extends UserModel {
  static properties = {
    key: {
      type: 'string',
      primary: true
    }
  }
}

class Shelf extends Model {
  static hooks = {
    'before:login'() {
      events.push('before:login shelf')
    }
  }
}

class Readers extends Controller {
  actions = {
    async 'post login'(ctx) {
      const { id, session } = ctx.request.body
      await ctx.login(await Reader.query().findById(id), { session })
      return getState(ctx)
    },

    // Log in users loaded without their `hash`:
    async 'post id-login'(ctx) {
      const { id } = ctx.request.body
      await ctx.login(await Reader.query().findById(id).select('id'))
      return getState(ctx)
    },

    async 'post shelf-login'(ctx) {
      await ctx.login(Shelf.fromJson({ id: 1 }))
      return getState(ctx)
    },

    async 'post sessionless-login'(ctx) {
      // Clear the session the way logouts do:
      ctx.session = null
      await ctx.login(await Reader.query().findById(ctx.request.body.id))
      return getState(ctx)
    },

    async 'post logout'(ctx) {
      await ctx.logout()
      return getState(ctx)
    },

    'get state'(ctx) {
      return getState(ctx)
    },

    // Store identifiers in the session the way logins do:
    'post identifier'(ctx) {
      ctx.session.passport = { user: ctx.request.body.identifier }
      return null
    }
  }
}

function getState(ctx) {
  return {
    user: ctx.state.user?.$id() ?? null,
    authenticated: ctx.isAuthenticated(),
    loggedUser: ctx.logger.bindings().user?.id ?? null,
    identifier: ctx.session?.passport?.user ?? null
  }
}

// Booting PGlite can exceed the default timeout under full-suite load.
describe('handleUser()', { timeout: 30_000 }, () => {
  const app = new Application({
    config: {
      app: {
        normalizePaths: true,
        keys: ['reader-secret'],
        session: true
      },
      knex: createTestKnex(),
      log: { silent: true },
      logger: { level: 'silent' },
      server: { host: '127.0.0.1', port: 0 }
    },
    models: { Reader, KeyedReader, Shelf },
    controllers: { Readers }
  })

  let cookie
  const request = async (path, body) => {
    const { port } = app.server.address()
    const response = await fetch(`http://127.0.0.1:${port}/readers/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { cookie, 'content-type': 'application/json' },
      body: body && JSON.stringify(body)
    })
    const setCookie = response.headers.getSetCookie()
    if (setCookie.length > 0) {
      cookie = setCookie.map(entry => entry.split(';')[0]).join('; ')
    }
    return response.status === 204 ? null : response.json()
  }

  beforeAll(async () => {
    const { knex } = app
    for (const [name, key] of [['Reader', 'id'], ['KeyedReader', 'key']]) {
      await knex.schema.createTable(name, table => {
        table.string(key).primary()
        table.string('username')
        table.string('hash')
        table.timestamp('lastLogin')
      })
    }
    await Reader.query().insert({ id: uuid, username: 'someone' })
    await KeyedReader.query().insert({ key: 'k-1', username: 'someone' })
    // `Reader` replaces the properties of `UserMixin`, so we set `hash` here:
    await knex('Reader').insert({ id: passwordId, hash: 'hash' })
    await app.start()
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
  })

  beforeEach(() => {
    cookie = ''
    events.length = 0
  })

  it('logs in users and restores them from the session', async () => {
    expect((await request('state')).authenticated).toBe(false)
    expect(await request('login', { id: uuid })).toEqual({
      user: uuid,
      authenticated: true,
      loggedUser: null,
      identifier: `Reader-${uuid}`
    })
    // Restored users are bound to the logger of the request too:
    expect(await request('state')).toEqual({
      user: uuid,
      authenticated: true,
      loggedUser: uuid,
      identifier: `Reader-${uuid}`
    })
  })

  it('restores users from identifiers of existing sessions', async () => {
    await request('identifier', { identifier: `Reader-${uuid}` })
    expect((await request('state')).user).toBe(uuid)
    await request('identifier', { identifier: 'KeyedReader-k-1' })
    expect((await request('state')).user).toBe('k-1')
  })

  it('drops identifiers that do not refer to users', async () => {
    for (const identifier of [
      'Reader',
      `Reader-${goneId}`,
      'Shelf-1',
      'Unknown-1'
    ]) {
      await request('identifier', { identifier })
      expect(await request('state')).toMatchObject({
        user: null,
        identifier: null
      })
    }
  })

  it('keeps the session of users logged in without their hash', async () => {
    expect((await request('id-login', { id: passwordId })).user).toBe(
      passwordId
    )
    expect((await request('state')).user).toBe(passwordId)
  })

  it('refuses to log in models that are not users', async () => {
    const response = await request('shelf-login', {})
    expect(response.message).toBe(
      `Unable to log in 'Shelf', which isn't a user.`
    )
    expect((await request('state')).authenticated).toBe(false)
    expect(events).toEqual([])
  })

  it('refuses to log in without sessions', async () => {
    const response = await request('sessionless-login', { id: uuid })
    expect(response.message).toBe(
      `Unable to log in without sessions, see 'app.session'.`
    )
    expect(events).toEqual([])
  })

  it('logs in without a session only for the request', async () => {
    expect(await request('login', { id: uuid, session: false })).toEqual({
      user: uuid,
      authenticated: true,
      loggedUser: null,
      identifier: null
    })
    expect((await request('state')).authenticated).toBe(false)
  })

  it('logs out users and clears the session', async () => {
    await request('login', { id: uuid })
    expect(await request('logout', {})).toEqual({
      user: null,
      authenticated: false,
      loggedUser: uuid,
      identifier: null
    })
    expect((await request('state')).authenticated).toBe(false)
  })

  it('emits login and logout events on the user', async () => {
    await request('login', { id: uuid })
    await request('logout', {})
    expect(events).toEqual([
      `before:login ${uuid} {}`,
      `after:login ${uuid}`,
      `before:logout ${uuid}`,
      `after:logout ${uuid}`
    ])
  })
})
