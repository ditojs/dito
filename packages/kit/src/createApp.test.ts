import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Hono } from 'hono'
import { defineEntity, p } from '@mikro-orm/core'
import { hashPassword } from '@ditojs/auth'
import { defineModelController } from '@ditojs/mikro'
import { createApp, type App } from './index.ts'
import { secrets } from '../../auth/src/test/helpers.ts'
import { createClient } from '../../../tests/utils/client.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { Asset, Credential, Session } from '../../../tests/utils/entities.ts'

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    title: p.string()
  }
})
class Book extends BookSchema.class {}
BookSchema.setClass(Book)

// The users of the two areas.
const userProperties = {
  id: p.integer().primary(),
  username: p.string(),
  hash: p.string().nullable().hidden(),
  roles: p.json<string[]>().nullable(),
  lastLogin: p.datetime().nullable()
}
const AdminSchema = defineEntity({ name: 'Admin', properties: userProperties })
class Admin extends AdminSchema.class {}
AdminSchema.setClass(Admin)
const MemberSchema = defineEntity({
  name: 'Member',
  properties: userProperties
})
class Member extends MemberSchema.class {}
MemberSchema.setClass(Member)

const entities = { Book, Admin, Member, Session, Credential, Asset }

const books = (role: string) =>
  defineModelController({
    path: 'books',
    entity: Book,
    authorize: role,
    actions: { 'get': true, 'post': true, 'get :id': true }
  })

describe('createApp()', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>
  let folder: string
  let app: App
  // What the services did, in order.
  let log: string[]
  // What the logger wrote: its bindings, and the last argument of each call.
  let logs: Record<string, unknown>[]

  const service = (name: string) => ({
    start: () => void log.push(`${name} start`),
    stop: () => void log.push(`${name} stop`)
  })

  beforeAll(async () => {
    database = await createTestDatabase(Object.values(entities))
    folder = await mkdtemp(path.join(tmpdir(), 'dito-kit-'))
    await writeFile(path.join(folder, 'cover.txt'), 'Cover')
    const { host, user, dbName } = database.orm.config.getAll()
    app = createApp({
      entities,
      database: { host, user, dbName },
      server: { host: '127.0.0.1' },
      logger: {
        hooks: {
          // Collects the logs instead of writing them.
          logMethod(args) {
            logs.push({ ...this.bindings(), entry: args.at(-1) })
          }
        }
      },
      secrets,
      storages: {
        covers: { type: 'disk', path: folder, url: '/covers/' },
        remote: {
          type: 'disk',
          path: folder,
          url: 'https://assets.example.com/'
        }
      }
    })

    // Each API has its own session cookie and its own users.
    const areas = {
      '/api/admin': { entity: Admin, role: 'admin' },
      '/api': { entity: Member, role: 'member' }
    }
    for (const [prefix, { entity, role }] of Object.entries(areas)) {
      const users = app.createUsers(entity as typeof Admin, {
        session: { cookieName: `${role}.sess`, maxAge: 60_000 },
        serialize: ['id', 'username']
      })
      app.routeApi(prefix, {
        controllers: [
          { path: 'users', mixins: [users.defineActions()] },
          books(role)
        ],
        users
      })
    }

    app.routeApi('/failing', {
      controllers: [
        {
          path: 'books',
          actions: {
            get() {
              throw new Error('Failed')
            }
          }
        }
      ]
    })
    app.hono.get('/logger', c => c.json(app.logger.bindings()))
    app.hono.get('/failing', () => {
      throw new Error('Failed')
    })

    const pages = new Hono()
    pages.get('/', c => c.text('Pages'))
    app.hono.route('/pages', pages)
  })

  afterAll(async () => {
    await app.close()
    await database.drop()
    await rm(folder, { recursive: true })
  })

  beforeEach(async () => {
    log = []
    logs = []
    await database.orm.schema.clear()
    const em = app.orm.em.fork()
    const hash = await hashPassword('secret')
    em.create(Admin, { username: 'ada', hash, roles: ['admin'] })
    em.create(Member, { username: 'max', hash, roles: ['member'] })
    await em.flush()
  })

  const login = async (prefix: string, username: string) => {
    const client = createClient(app.hono.fetch)
    await client.request('POST', `${prefix}/users/login`, {
      username,
      password: 'secret'
    })
    return client
  }

  it('routes each API with the users of its own session', async () => {
    const admin = await login('/api/admin', 'ada')
    const created = await admin.request('POST', '/api/admin/books', {
      title: 'Dune'
    })
    expect(created.status).toBe(201)
    // The session of an admin is none of the member API.
    expect((await admin.request('GET', '/api/books')).status).toBe(401)
    const member = await login('/api', 'max')
    const { data } = await member.request('GET', '/api/books')
    expect(data).toEqual([{ id: created.data.id, title: 'Dune' }])
    expect((await member.request('GET', '/api/admin/books')).status).toBe(401)
  })

  it('gives `app.logger` the id of the current request', async () => {
    const response = await app.hono.request('/logger')
    expect((await response.json()).requestId).toBe(
      response.headers.get('X-Request-Id')
    )
    expect(app.logger.bindings()).not.toHaveProperty('requestId')
  })

  it('logs errors with the id of their request', async () => {
    expect((await app.hono.request('/failing/books')).status).toBe(500)
    const [failed, response] = logs
    expect((failed!.entry as Error).message).toBe('Failed')
    expect(failed!.requestId).toBeTypeOf('string')
    expect(response!.entry).toContain('GET /failing/books 500')
    expect(response!.requestId).toBe(failed!.requestId)
    logs = []
    expect((await app.hono.request('/failing')).status).toBe(500)
    expect((logs[0]!.entry as Error).message).toBe('Failed')
    expect(logs[0]!.requestId).toBeTypeOf('string')
  })

  it('gives scripts the ORM without a server', async () => {
    const em = app.orm.em.fork()
    em.create(Book, { title: 'Emma' })
    await em.flush()
    expect(await em.count(Book)).toBe(1)
  })

  it('serves the disk storages at their `url`', async () => {
    const response = await app.hono.request('/covers/cover.txt')
    expect(await response.text()).toBe('Cover')
  })

  it('serves no disk storage with a `url` without a path', async () => {
    const response = await app.hono.request('/cover.txt')
    expect(response.status).toBe(404)
  })

  it('answers as the app of `createHono()`', async () => {
    const response = await app.hono.request('/pages/')
    expect(await response.text()).toBe('Pages')
    const missing = await app.hono.request('/other')
    expect(await missing.json()).toEqual({ message: 'Not Found', status: 404 })
  })

  it('runs the jobs while the app runs', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const results: unknown[] = []
    const app = createApp({
      entities,
      database: { host, user, dbName },
      server: { host: '127.0.0.1' },
      logger: { level: 'silent' },
      secrets,
      jobs: {
        sessions: 5,
        assets: '5ms',
        afterAssets: result => void results.push(result)
      }
    })
    app.createUsers(Admin, {
      session: { cookieName: 'admin.sess', maxAge: 60_000 }
    })
    await database.db
      .insertInto('session')
      .values({ id: 'old', value: '{}', expires_at: new Date(0) })
      .execute()
    await app.start()
    await vi.waitFor(async () => {
      expect(results.length).toBeGreaterThan(1)
      expect(await database.db.selectFrom('session').selectAll().execute())
        .toEqual([])
    })
    await app.close()
    const { length } = results
    expect(results[0]).toMatchObject({ scan: { rowCount: 0 }, released: [] })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(results).toHaveLength(length)
  })

  it('runs no jobs without an interval', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const afterAssets = vi.fn()
    const app = createApp({
      entities,
      database: { host, user, dbName },
      server: { host: '127.0.0.1' },
      logger: { level: 'silent' },
      jobs: { assets: false, afterAssets }
    })
    await app.start()
    await new Promise(resolve => setTimeout(resolve, 20))
    await app.close()
    expect(afterAssets).not.toHaveBeenCalled()
  })

  it('logs the errors of jobs and keeps running them', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const errors: unknown[] = []
    const app = createApp({
      entities,
      database: { host, user, dbName },
      server: { host: '127.0.0.1' },
      logger: {
        hooks: {
          logMethod(args) {
            errors.push(args.at(-1))
          }
        }
      },
      jobs: {
        assets: 5,
        afterAssets: () => {
          throw new Error('Failed job')
        }
      }
    })
    await app.start()
    await vi.waitFor(() => expect(errors.length).toBeGreaterThan(1))
    await app.close()
    expect((errors[0] as Error).message).toBe('Failed job')
  })

  it('runs the services around the server, and closes the ORM', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const app = createApp({
      entities,
      database: { host, user, dbName },
      server: { host: '127.0.0.1' },
      logger: { level: 'silent' }
    })
    app.hono.get('/pages', c => c.text('Pages'))
    const server = await app.start({
      services: [service('mailer'), service('scheduler')]
    })
    const { port } = server.address() as AddressInfo
    const response = await fetch(`http://127.0.0.1:${port}/pages`)
    expect(await response.text()).toBe('Pages')
    await app.close()
    expect(server.listening).toBe(false)
    expect(await app.orm.isConnected()).toBe(false)
    expect(log).toEqual([
      'mailer start',
      'scheduler start',
      'scheduler stop',
      'mailer stop'
    ])
  })
})
