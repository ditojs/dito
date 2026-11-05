import type { Kysely } from 'kysely'
import { Hono } from 'hono'
import { generateSignedCookie } from 'hono/cookie'
import { createApi, type ControllerDefinition } from '@ditojs/server'
import {
  createCredentials,
  createSessions,
  hashPassword,
  usersRoutes,
  type UserSource,
  type UsersRoutesOptions
} from '../src/index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { Credential, Session } from '../../../tests/utils/entities.ts'

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
    findById: async (c, id) => users.find(user => String(user.id) === id),
    findByUsername: async (c, username) =>
      users.find(user => user.username === username),
    patch: async (c, user, values) => {
      Object.assign(user, values)
    },
    serialize: (c, { hash, ...user }) => user
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
  name = 'admin.sess',
  secrets: cookieSecrets = secrets,
  controllers = [],
  ...options
}: {
  db: Kysely<any>
  source: UserSource<TestUser>
  name?: string
  secrets?: string[]
  // More controllers of the API, next to the users routes.
  controllers?: ControllerDefinition[]
} & Partial<UsersRoutesOptions<TestUser>>) {
  const sessions = createSessions({
    db: () => db,
    secrets: cookieSecrets,
    name,
    maxAge: 24 * 60 * 60 * 1000
  })
  const credentials = createCredentials(() => db)
  const users = usersRoutes({
    path: 'admins',
    source,
    credentials,
    ...options
  })
  // The sessions run before the API, as in the app's host.
  const api = new Hono()
  api.use(sessions.middleware)
  api.route('/', createApi({ controllers: [users.controller, ...controllers] }))
  return { api, sessions, credentials, users }
}

// The value of a cookie as a browser stores it, signed with `secret`.
export async function signCookie(name: string, value: string, secret: string) {
  const cookie = await generateSignedCookie(name, value, secret)
  return cookie.split(';')[0]!.slice(name.length + 1)
}
