import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import { Hono } from 'hono'
import { problemResponse } from '@ditojs/server-next'
import {
  createCredentials,
  createSessionStore,
  createSessions,
  hashPassword,
  koaCookies,
  usersRoutes,
  type UserSource,
  type UsersRoutesOptions
} from '../src/index.ts'

export const keys = ['secret sauce']

export interface TestUser {
  id: number
  username: string
  hash: string | null
  roles: string[]
  lastLogin: Date | null
  name?: string
}

export async function createDatabase() {
  const db = new Kysely<any>({
    dialect: new SqliteDialect({ database: new Database(':memory:') })
  })
  await db.schema
    .createTable('session')
    .addColumn('id', 'text', col => col.primaryKey())
    .addColumn('value', 'text', col => col.notNull())
    .addColumn('expires_at', 'text')
    .execute()
  await db.schema
    .createTable('credential')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('created_at', 'text')
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('user_model', 'text', col => col.notNull())
    .addColumn('user_id', 'text', col => col.notNull())
    .addColumn('key', 'text')
    .addColumn('name', 'text')
    .addColumn('data', 'text')
    .addColumn('last_used_at', 'text')
    .addUniqueConstraint('credential_user_model_key', ['user_model', 'key'])
    .execute()
  return db
}

// The users live in memory, as the app's ORM would load them.
export function createSource(
  name: string,
  users: TestUser[],
  usernameField = 'username'
): UserSource<TestUser> {
  return {
    name,
    usernameField,
    findById: async (c, id) => users.find(user => String(user.id) === id),
    findByUsername: async (c, username) =>
      users.find(user => user.username === username),
    describe: user => user,
    setPassword: async (c, user, hash) => {
      user.hash = hash
    },
    touchLogin: async (c, user) => {
      user.lastLogin = new Date()
    },
    update: async (c, user, values) => Object.assign(user, values),
    toJSON: (c, { hash, ...user }) => user
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
  keys: cookieKeys = keys,
  ...options
}: {
  db: Kysely<any>
  source: UserSource<TestUser>
  name?: string
  keys?: string[]
} & Partial<UsersRoutesOptions<TestUser>>) {
  const sessions = createSessions({
    store: createSessionStore(() => db),
    cookies: koaCookies(cookieKeys),
    name,
    maxAge: 24 * 60 * 60 * 1000
  })
  const credentials = createCredentials(() => db)
  const users = usersRoutes({ sessions, source, credentials, ...options })
  const app = new Hono()
  app.onError(problemResponse)
  app.use(sessions.middleware)
  app.route('/admins', users.app)
  return { app, sessions, credentials, users }
}

// A browser's cookie jar for one host.
export function createClient(app: Hono, origin = 'https://example.com') {
  const jar = new Map<string, string>()
  async function request(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {}
    if (jar.size > 0) {
      headers.Cookie = [...jar]
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const response = await app.request(`${origin}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
    for (const cookie of response.headers.getSetCookie()) {
      const [pair, ...attributes] = cookie.split('; ')
      const index = pair.indexOf('=')
      const key = pair.slice(0, index)
      const isExpired = attributes.some(
        attribute => attribute === `expires=${new Date(0).toUTCString()}`
      )
      if (isExpired) jar.delete(key)
      else jar.set(key, pair.slice(index + 1))
    }
    const text = await response.text()
    return {
      status: response.status,
      data: text ? JSON.parse(text) : undefined,
      cookies: response.headers.getSetCookie()
    }
  }
  return {
    jar,
    request,
    get: (path: string) => request('GET', path),
    post: (path: string, body: unknown = {}) => request('POST', path, body),
    patch: (path: string, body: unknown = {}) => request('PATCH', path, body),
    delete: (path: string) => request('DELETE', path)
  }
}
