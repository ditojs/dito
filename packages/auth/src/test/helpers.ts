import type { Kysely } from 'kysely'
import { Hono } from 'hono'
import { generateSignedCookie } from 'hono/cookie'
import { createApi, type ControllerDefinition } from '@ditojs/server'
import { defaultPasswordSchema } from '@ditojs/mikro/internal'
import { createCredentials } from '../credentials.ts'
import { hashPassword } from '../passwords.ts'
import { createSessions } from '../sessions.ts'
import {
  defineUserActions,
  type DefineUserActionsOptions
} from '../userActions.ts'
import type { UserSource } from '../users.ts'
import { createTestDatabase } from '../../../../tests/utils/database.ts'
import { Credential, Session } from '../../../../tests/utils/entities.ts'

export const secrets = ['secret sauce']

// A database with the `session` and `credential` tables, created once per test
// file and emptied before each test. Returns a function that gives its Kysely.
export function useTestDatabase() {
  let database: Awaited<ReturnType<typeof createTestDatabase>>
  beforeAll(async () => {
    database = await createTestDatabase([Session, Credential])
  })
  afterAll(() => database?.drop())
  beforeEach(() => database.orm.schema.clear())
  return () => database.db
}

export interface TestUser {
  id: number
  username: string
  hash: string | null
  roles: string[]
  lastLogin: Date | null
}

// The users live in memory, as the app's ORM would load them.
export function createSource(
  name: string,
  users: TestUser[]
): UserSource<TestUser> {
  return {
    name,
    usernameProperty: 'username',
    password: defaultPasswordSchema,
    findById: async id => users.find(user => String(user.id) === id) ?? null,
    findByUsername: async username => (
      users.find(user => user.username === username) ?? null
    ),
    patch: async (user, values) => {
      Object.assign(user, values)
    },
    serialize: ({ hash, ...user }) => user
  }
}

export async function createUser(
  id: number,
  username: string,
  password: string | null,
  roles = ['admin']
): Promise<TestUser> {
  return {
    id,
    username,
    hash: password ? await hashPassword(password) : null,
    roles,
    lastLogin: null
  }
}

export function setup({
  db,
  source,
  cookieName = 'admin.sess',
  secrets: cookieSecrets = secrets,
  maxAge = 24 * 60 * 60 * 1000,
  controllers = [],
  credentials,
  ...options
}: {
  db: Kysely<any>
  source: UserSource<TestUser>
  cookieName?: string
  secrets?: string[]
  maxAge?: number | string
  // More controllers of the API, next to the users routes.
  controllers?: ControllerDefinition[]
} & Partial<DefineUserActionsOptions<TestUser>>) {
  const adapter = { getKysely: () => db }
  const sessions = createSessions({
    adapter,
    secrets: cookieSecrets,
    cookieName,
    maxAge,
    source
  })
  credentials ??= createCredentials({ adapter, source })
  const users = {
    path: 'admins',
    mixins: [defineUserActions({ source, credentials, ...options })]
  }
  // The sessions run before the API, as in the app's host.
  const api = new Hono()
  api.use(sessions.middleware)
  api.route('/', createApi({ controllers: [users, ...controllers] }))
  return { api, sessions, credentials }
}

// The value of a cookie as a browser stores it, signed with `secret`.
export async function signCookie(name: string, value: string, secret: string) {
  const cookie = await generateSignedCookie(name, value, secret)
  return cookie.split(';')[0]!.slice(name.length + 1)
}
