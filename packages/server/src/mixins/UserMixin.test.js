import passport from 'koa-passport'
import { Application } from '../app/Application.js'
import { AuthenticationError } from '../errors/index.js'
import { UserModel } from '../models/UserModel.js'

class SessionUser extends UserModel {
  static properties = {
    id: {
      type: 'string',
      format: 'uuid',
      primary: true
    }
  }

  static sessionQuery() {
    return {
      findById: id => SessionUser.fromJson({ id, username: 'someone' })
    }
  }
}

class KeyedSessionUser extends UserModel {
  static properties = {
    key: {
      type: 'string',
      primary: true
    }
  }

  static sessionQuery() {
    return {
      findById: key => KeyedSessionUser.fromJson({ key, username: 'someone' })
    }
  }
}

const app = new Application({
  config: { log: { silent: true } },
  models: { SessionUser, KeyedSessionUser }
})

beforeAll(() => app.setupModels())

function serializeUser(user) {
  return new Promise((resolve, reject) => {
    passport.serializeUser(user, {}, (err, identifier) =>
      err ? reject(err) : resolve(identifier)
    )
  })
}

function deserializeUser(identifier) {
  return new Promise((resolve, reject) => {
    passport.deserializeUser(identifier, { ctx: {} }, (err, user) =>
      err ? reject(err) : resolve(user)
    )
  })
}

describe('UserMixin session serialization', () => {
  const uuid = '4b0b6f1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b'

  it('round-trips users with hyphenated ids', async () => {
    const user = SessionUser.fromJson({ id: uuid, username: 'someone' })
    const identifier = await serializeUser(user)
    expect(identifier).toBe(`SessionUser-${uuid}`)
    const deserializedUser = await deserializeUser(identifier)
    expect(deserializedUser).toBeInstanceOf(SessionUser)
    expect(deserializedUser.id).toBe(uuid)
  })

  it('round-trips users with a custom id column', async () => {
    const user = KeyedSessionUser.fromJson({ key: 'k1', username: 'someone' })
    const identifier = await serializeUser(user)
    expect(identifier).toBe('KeyedSessionUser-k1')
    const deserializedUser = await deserializeUser(identifier)
    expect(deserializedUser).toBeInstanceOf(KeyedSessionUser)
    expect(deserializedUser.key).toBe('k1')
  })

  it('ignores identifiers without a separator', async () => {
    expect(await deserializeUser('SessionUserX')).toBeFalsy()
  })
})

describe('UserMixin.login()', () => {
  it('passes the strategy status on to the AuthenticationError', async () => {
    // `passport-local` fails missing credentials with status 400.
    const ctx = {
      req: {},
      request: { body: {} },
      query: {},
      state: {},
      set() {}
    }
    const error = await SessionUser.login(ctx).catch(error => error)
    expect(error).toBeInstanceOf(AuthenticationError)
    expect(error.message).toBe('Missing credentials')
    expect(error.status).toBe(400)
  })
})
