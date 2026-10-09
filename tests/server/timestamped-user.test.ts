// @ts-expect-error -- koa-passport comes without type declarations.
import passport from 'koa-passport'
import type { ModelProperties } from '@ditojs/server'
import {
  AuthenticationError,
  TimeStampedModel,
  UserMixin
} from '@ditojs/server'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

class Shelf extends TimeStampedModel {
  declare id: number
  declare label: string
  declare createdAt: Date
  declare updatedAt: Date

  static override properties: ModelProperties = {
    label: {
      type: 'string',
      required: true
    }
  }
}

// Users that log in with their email, and only when they are active.
class Librarian extends UserMixin(TimeStampedModel) {
  declare id: number
  declare email: string
  declare hash: string
  declare isActive: boolean
  declare roles: string[]

  static override options = {
    usernameProperty: 'email',
    sessionScope: 'active'
  }

  static override properties: ModelProperties = {
    email: {
      type: 'string',
      required: true
    },
    isActive: {
      type: 'boolean',
      default: true
    },
    roles: {
      type: 'array',
      items: { type: 'string' },
      default: []
    }
  }

  static override scopes = {
    active: (query: any) => query.where('isActive', true)
  }
}

const app = createTestApp({ models: { Shelf, Librarian } })

function createLibrarian(json: Record<string, any>) {
  return Librarian.fromJson(json) as Librarian
}

function createLoginContext(body: Record<string, any>): any {
  return {
    req: {},
    request: { body },
    query: {},
    state: {} as Record<string, any>,
    set() {},
    login: vi.fn(async () => {})
  }
}

function deserializeUser(identifier: string) {
  return new Promise((resolve, reject) => {
    ;(passport as any).deserializeUser(
      identifier,
      { ctx: {} },
      (err: Error | null, user: any) => (err ? reject(err) : resolve(user))
    )
  })
}

let alice: Librarian
let bob: Librarian

beforeAll(async () => {
  await app.setup()
  await createTestDatabase(app)
  // The computed `password` property isn't stored in the database.
  await app.knex.schema.alterTable('Librarian', table => {
    table.dropColumn('password')
  })
  alice = await Librarian.query().insertAndFetch({
    email: 'alice@example.com',
    password: 'open sesame',
    roles: ['curator', 'lender']
  } as any)
  bob = await Librarian.query().insertAndFetch({
    email: 'bob@example.com',
    password: 'retired',
    isActive: false
  } as any)
})

afterAll(async () => {
  await destroyTestApp(app)
})

describe('TimeStampedMixin', () => {
  afterEach(async () => {
    await Shelf.query().delete()
  })

  it('sets `createdAt` and `updatedAt` on insert', async () => {
    const before = Date.now()
    const shelf = await Shelf.query().insertAndFetch({ label: 'Poetry' })
    expect(shelf.createdAt).toBeInstanceOf(Date)
    expect(shelf.updatedAt).toEqual(shelf.createdAt)
    expect(shelf.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000)
  })

  it('ignores passed time stamps on insert', async () => {
    const shelf = await Shelf.query().insertAndFetch({
      label: 'Poetry',
      createdAt: new Date('2000-01-01T00:00:00.000Z')
    } as any)
    expect(shelf.createdAt.getFullYear()).toBeGreaterThan(2000)
  })

  it('only updates `updatedAt` on patch', async () => {
    const shelf = await Shelf.query().insertAndFetch({ label: 'Poetry' })
    await new Promise(resolve => setTimeout(resolve, 10))
    const patched = await Shelf.query().patchAndFetchById(shelf.id, {
      label: 'Prose'
    })
    expect(patched.label).toBe('Prose')
    expect(patched.createdAt).toEqual(shelf.createdAt)
    expect(patched.updatedAt.getTime()).toBeGreaterThan(
      shelf.updatedAt.getTime()
    )
  })

  it('provides a `timeStamped` scope selecting the time stamps', async () => {
    await Shelf.query().insert({ label: 'Poetry' })
    const [shelf] = await Shelf.query().withScope('timeStamped')
    expect(Object.keys(shelf).sort()).toEqual(['createdAt', 'updatedAt'])
  })
})

describe('UserMixin', () => {
  describe('passwords', () => {
    it('stores a hash instead of the password', async () => {
      const [row] = await app.knex('Librarian').where('id', alice.id)
      expect(row.hash).toMatch(/^\$2[aby]\$10\$/)
      expect(row.password).toBeUndefined()
      expect(alice.password).toBeUndefined()
    })

    it('hides the hash in JSON data', () => {
      const json = alice.$toJson()
      expect(json).not.toHaveProperty('hash')
      expect(json).not.toHaveProperty('password')
      expect(json.email).toBe('alice@example.com')
    })

    it('verifies passwords against the hash', async () => {
      expect(await alice.$verifyPassword('open sesame')).toBe(true)
      expect(await alice.$verifyPassword('Open Sesame')).toBe(false)
    })

    it('creates a new hash when setting a new password', () => {
      const user = createLibrarian({ email: 'c@example.com' })
      user.password = 'one'
      const { hash } = user
      user.password = 'one'
      expect(user.hash).not.toBe(hash)
    })
  })

  describe('$hasRole()', () => {
    it('returns the first matching role', () => {
      expect(alice.$hasRole('lender')).toBe('lender')
      expect(alice.$hasRole('admin', 'curator')).toBe('curator')
    })

    it('returns false without matching roles', () => {
      expect(alice.$hasRole('admin')).toBe(false)
      expect(bob.$hasRole('curator')).toBe(false)
      expect(createLibrarian({ email: 'x' }).$hasRole('admin')).toBe(false)
    })
  })

  it('$hasOwner() compares users by id', () => {
    const owner = createLibrarian({ id: alice.id, email: alice.email })
    expect(alice.$hasOwner(owner)).toBe(true)
    expect(alice.$hasOwner(bob)).toBe(false)
  })

  it('$isLoggedIn() compares with the user of the request', () => {
    const user = createLibrarian({ id: alice.id, email: alice.email })
    const ctx: any = { state: { user } }
    expect(alice.$isLoggedIn(ctx)).toBe(true)
    expect(bob.$isLoggedIn(ctx)).toBe(false)
  })

  describe('login()', () => {
    it('logs in users with the configured username property', async () => {
      const ctx = createLoginContext({
        email: 'alice@example.com',
        password: 'open sesame'
      })
      const user = (await Librarian.login(ctx, { session: true })) as Librarian
      expect(user).toBeInstanceOf(Librarian)
      expect(user.id).toBe(alice.id)
      expect(ctx.login).toHaveBeenCalledWith(user, { session: true })
    })

    it('rejects wrong passwords with an AuthenticationError', async () => {
      const ctx = createLoginContext({
        email: 'alice@example.com',
        password: 'wrong'
      })
      const error = await Librarian.login(ctx).catch(error => error)
      expect(error).toBeInstanceOf(AuthenticationError)
      expect(error.message).toBe('Password or username is incorrect')
      expect(error.status).toBe(401)
      expect(ctx.login).not.toHaveBeenCalled()
    })

    it('rejects unknown users', async () => {
      const ctx = createLoginContext({
        email: 'nobody@example.com',
        password: 'open sesame'
      })
      await expect(Librarian.login(ctx)).rejects.toBeInstanceOf(
        AuthenticationError
      )
    })

    it('rejects users excluded by the session scope', async () => {
      const ctx = createLoginContext({
        email: 'bob@example.com',
        password: 'retired'
      })
      await expect(Librarian.login(ctx)).rejects.toBeInstanceOf(
        AuthenticationError
      )
    })

    it('rejects when logging in the session fails', async () => {
      const ctx = createLoginContext({
        email: 'alice@example.com',
        password: 'open sesame'
      })
      ctx.login.mockRejectedValue(new Error('Session store is down'))
      await expect(Librarian.login(ctx)).rejects.toThrow(
        'Session store is down'
      )
    })

    it('rejects when the user query fails', async () => {
      const ctx = createLoginContext({
        email: 'alice@example.com',
        password: 'open sesame'
      })
      const sessionQuery = vi
        .spyOn(Librarian, 'sessionQuery')
        .mockImplementation(() => {
          throw new Error('Database is down')
        })
      try {
        await expect(Librarian.login(ctx)).rejects.toThrow('Database is down')
      } finally {
        sessionQuery.mockRestore()
      }
    })
  })

  describe('session deserialization', () => {
    it('loads users through the session scope', async () => {
      const user: any = await deserializeUser(`Librarian-${alice.id}`)
      expect(user).toBeInstanceOf(Librarian)
      expect(user.id).toBe(alice.id)
    })

    // `findById()` resolves to `undefined` for users that are excluded by the
    // session scope or were deleted, which passport treats as "not handled",
    // failing with an error instead of ending the session.
    test('logs out users excluded by the session scope', async () => {
      expect(await deserializeUser(`Librarian-${bob.id}`)).toBe(false)
    })

    test('logs out users that no longer exist', async () => {
      expect(await deserializeUser('Librarian-999999')).toBe(false)
    })

    it('ignores identifiers of unknown user classes', async () => {
      expect(await deserializeUser(`Shelf-${alice.id}`)).toBe(false)
    })

    it('passes on query errors', async () => {
      await expect(deserializeUser('Librarian-not-a-number')).rejects.toThrow()
    })
  })

  it('does not serialize users of unregistered classes', async () => {
    const promise = new Promise((resolve, reject) => {
      ;(passport as any).serializeUser(
        Shelf.fromJson({ id: 1, label: 'Poetry' }),
        {},
        (err: Error | null, id: any) => (err ? reject(err) : resolve(id))
      )
    })
    await expect(promise).rejects.toThrow('Failed to serialize user')
  })
})
