import type { ModelProperties } from '@ditojs/server'
import {
  AuthenticationError,
  Model,
  TimestampedModel,
  UserMixin
} from '@ditojs/server'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

class Shelf extends TimestampedModel {
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
class Librarian extends UserMixin(TimestampedModel) {
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

class Account extends Model {
  static setupClasses: string[] = []

  static override setup() {
    super.setup()
    Account.setupClasses.push(this.name)
  }
}

// Users that log in with a pin, set up through their base class too.
class Patron extends UserMixin(Account) {
  declare hash: string

  static override options = {
    passwordProperty: 'pin'
  }
}

const app = createTestApp({ models: { Shelf, Librarian, Patron } })

function createLibrarian(json: Record<string, any>) {
  return Librarian.fromJson(json) as Librarian
}

function createLoginContext(body: Record<string, any>): any {
  return {
    request: { body },
    login: vi.fn(async () => {})
  }
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

describe('TimestampedMixin', () => {
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

  it('provides a `timestamped` scope selecting the time stamps', async () => {
    await Shelf.query().insert({ label: 'Poetry' })
    const [shelf] = await Shelf.query().withScope('timestamped')
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

    it('hashes passwords of other `passwordProperty` names', async () => {
      const patron = Patron.fromJson({ username: 'carol', pin: '1234' } as any)
      expect(patron.hash).toMatch(/^\$2[aby]\$10\$/)
      expect((patron as any).pin).toBeUndefined()
      expect(await patron.$verifyPassword('1234')).toBe(true)
    })

    it('creates a new hash when setting a new password', () => {
      const user = createLibrarian({ email: 'c@example.com' })
      user.password = 'one'
      const { hash } = user
      user.password = 'one'
      expect(user.hash).not.toBe(hash)
    })
  })

  it('calls `setup()` of the base class', () => {
    expect(Account.setupClasses).toEqual(['Patron'])
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

  describe('authenticate()', () => {
    it('checks users with the configured username property', async () => {
      const ctx = createLoginContext({
        email: 'alice@example.com',
        password: 'open sesame'
      })
      const user = (await Librarian.authenticate(ctx)) as Librarian
      expect(user).toBeInstanceOf(Librarian)
      expect(user.id).toBe(alice.id)
      // The caller logs the user in:
      expect(ctx.login).not.toHaveBeenCalled()
    })

    it('rejects wrong passwords with an AuthenticationError', async () => {
      const ctx = createLoginContext({
        email: 'alice@example.com',
        password: 'wrong'
      })
      const error = await Librarian.authenticate(ctx).catch(error => error)
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
      await expect(Librarian.authenticate(ctx)).rejects.toBeInstanceOf(
        AuthenticationError
      )
    })

    it('rejects users excluded by the session scope', async () => {
      const ctx = createLoginContext({
        email: 'bob@example.com',
        password: 'retired'
      })
      await expect(Librarian.authenticate(ctx)).rejects.toBeInstanceOf(
        AuthenticationError
      )
    })

    it('rejects when the user query fails', async () => {
      const ctx = createLoginContext({
        email: 'alice@example.com',
        password: 'open sesame'
      })
      // A failing database can't be reached otherwise:
      const query = vi.spyOn(Librarian, 'query').mockImplementation(() => {
        throw new Error('Database is down')
      })
      try {
        await expect(Librarian.authenticate(ctx)).rejects.toThrow(
          'Database is down'
        )
      } finally {
        query.mockRestore()
      }
    })
  })
})
