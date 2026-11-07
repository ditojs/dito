import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Hono } from 'hono'
import { defineEntity, p } from '@mikro-orm/core'
import { hashPassword } from '@ditojs/auth'
import { defineModelController } from '@ditojs/mikro'
import { createApp, type App, type JobsOptions } from './index.ts'
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
        session: { cookieName: `${role}.sess`, expiresAfter: 60_000 },
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

  it('limits the uploads with `maxSize` of `assets`', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const app = createApp({
      entities,
      database: { host, user, dbName },
      logger: { level: 'silent' },
      storages: { covers: { type: 'disk', path: folder, url: '/covers/' } },
      assets: { maxSize: '5b' }
    })
    const uploads = [{ dataPath: 'covers', storage: 'covers' }]
    app.routeApi('/api', {
      controllers: [
        {
          path: 'books',
          authorize: true,
          mixins: [app.assets.defineUploads({ uploads })]
        }
      ]
    })
    const upload = (text: string) => {
      const body = new FormData()
      body.append('file', new File([text], 'cover.txt'))
      return app.hono.request('/api/books/upload/covers', {
        method: 'POST',
        body
      })
    }
    expect((await upload('hi')).status).toBe(200)
    expect((await upload('too long')).status).toBe(413)
    await app.close()
  })

  it('runs the jobs while the app runs', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const results: unknown[] = []
    const app = createApp({
      entities,
      database: { host, user, dbName },
      server: { host: '127.0.0.1' },
      logger: {
        hooks: {
          logMethod(args) {
            results.push(args[0])
          }
        }
      },
      secrets,
      jobs: { sessions: 5, assets: '5ms' }
    })
    app.createUsers(Admin, {
      session: { cookieName: 'admin.sess', expiresAfter: 60_000 }
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
    expect(results[0]).toMatch(
      /^Asset jobs: 0 rows in \d+ms, 0 unreferenced, 0 missing, 0 released$/
    )
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(results).toHaveLength(length)
  })

  it('deletes the expired sessions every hour once the app has users', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const getIntervals = async (
      jobs: JobsOptions | undefined,
      withUsers: boolean
    ) => {
      const app = createApp({
        entities,
        database: { host, user, dbName },
        server: { host: '127.0.0.1' },
        logger: { level: 'silent' },
        secrets,
        jobs
      })
      if (withUsers) {
        app.createUsers(Admin, {
          session: { cookieName: 'admin.sess', expiresAfter: 60_000 }
        })
      }
      const setInterval = vi.spyOn(globalThis, 'setInterval')
      await app.start()
      const intervals = setInterval.mock.calls.map(([, interval]) => interval)
      setInterval.mockRestore()
      await app.close()
      return intervals
    }
    expect(await getIntervals(undefined, true)).toEqual([3_600_000])
    expect(await getIntervals({ sessions: 5 }, true)).toEqual([5])
    expect(await getIntervals({ sessions: false }, true)).toEqual([])
    expect(await getIntervals(undefined, false)).toEqual([])
  })

  it('runs no jobs without an interval', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const app = createApp({
      entities,
      database: { host, user, dbName },
      server: { host: '127.0.0.1' },
      logger: { level: 'silent' },
      jobs: { assets: false }
    })
    const runJobs = vi.spyOn(app.assets, 'runJobs')
    await app.start()
    await new Promise(resolve => setTimeout(resolve, 20))
    await app.close()
    expect(runJobs).not.toHaveBeenCalled()
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
            errors.push(args)
          }
        }
      },
      jobs: { assets: 5 }
    })
    vi.spyOn(app.assets, 'runJobs').mockRejectedValue(new Error('Failed job'))
    await app.start()
    await vi.waitFor(() => expect(errors.length).toBeGreaterThan(1))
    await app.close()
    const [error, message] = errors[0] as [Error, string]
    expect(error.message).toBe('Failed job')
    expect(message).toBe(`Job 'assets' failed`)
  })

  it('stops what started and closes the ORM when a service fails', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const app = createApp({
      entities,
      database: { host, user, dbName },
      server: { host: '127.0.0.1' },
      logger: { level: 'silent' }
    })
    app.addService('mailer', service('mailer'))
    app.addService('failing', {
      start: () => Promise.reject(new Error('Failed'))
    })
    await expect(app.start()).rejects.toThrow('Failed')
    expect(log).toEqual(['mailer start', 'mailer stop'])
    expect(await app.orm.isConnected()).toBe(false)
    await app.close()
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
    app.addService('mailer', service('mailer'))
    app.addService('scheduler', service('scheduler'))
    const server = await app.start()
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

  it('reads the services by name, and adds each name once', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const app = createApp({ entities, database: { host, user, dbName } })
    const mailer = service('mailer')
    app.addService('mailer', mailer)
    expect(app.services.mailer).toBe(mailer)
    expect(() => app.addService('mailer', service('other'))).toThrow(
      `Unable to add service 'mailer' twice.`
    )
    await app.close()
  })

  it('runs from after the services start until the requests end', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const app = createApp({
      entities,
      database: { host, user, dbName },
      server: { host: '127.0.0.1' },
      logger: { level: 'silent' }
    })
    const states: boolean[] = []
    let release = () => {}
    const released = new Promise<void>(resolve => {
      release = resolve
    })
    app.hono.get('/slow', async c => {
      await released
      states.push(app.isRunning)
      return c.text('Done')
    })
    app.addService('mailer', {
      start: () => void states.push(app.isRunning),
      stop: () => void states.push(app.isRunning)
    })
    expect(app.isRunning).toBe(false)
    const server = await app.start()
    expect(app.isRunning).toBe(true)
    const { port } = server.address() as AddressInfo
    const pending = fetch(`http://127.0.0.1:${port}/slow`)
    await vi.waitFor(async () => {
      const connections = await new Promise((resolve, reject) =>
        server.getConnections((error, count) =>
          error ? reject(error) : resolve(count)
        )
      )
      expect(connections).toBe(1)
    })
    const closed = app.close()
    release()
    await (await pending).text()
    await closed
    expect(states).toEqual([false, true, false])
    expect(app.isRunning).toBe(false)
  })

  it('starts the services alone, and stops them with `close()`', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const app = createApp({
      entities,
      database: { host, user, dbName },
      logger: { level: 'silent' },
      jobs: { assets: 5 }
    })
    const runJobs = vi.spyOn(app.assets, 'runJobs')
    app.addService('mailer', service('mailer'))
    await app.startServices()
    expect(app.isRunning).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(runJobs).not.toHaveBeenCalled()
    await app.close()
    expect(app.isRunning).toBe(false)
    expect(log).toEqual(['mailer start', 'mailer stop'])
    expect(await app.orm.isConnected()).toBe(false)
  })

  it('starts once, also while a start is pending', async () => {
    const { host, user, dbName } = database.orm.config.getAll()
    const app = createApp({
      entities,
      database: { host, user, dbName },
      server: { host: '127.0.0.1' },
      logger: { level: 'silent' }
    })
    app.addService('mailer', service('mailer'))
    const started = app.start()
    await expect(app.startServices()).rejects.toThrow(
      'Unable to start the app twice.'
    )
    await started
    await expect(app.start()).rejects.toThrow('Unable to start the app twice.')
    await app.close()
    expect(log).toEqual(['mailer start', 'mailer stop'])
  })

  describe('addJob()', () => {
    const createJobApp = (jobs?: JobsOptions | false) => {
      const { host, user, dbName } = database.orm.config.getAll()
      return createApp({
        entities,
        database: { host, user, dbName },
        server: { host: '127.0.0.1' },
        logger: { level: 'silent' },
        secrets,
        jobs
      })
    }

    afterEach(() => void vi.useRealTimers())

    it('runs jobs between the services, and waits for them', async () => {
      const app = createJobApp()
      let finish = () => {}
      app.addService('mailer', service('mailer'))
      app.addJob('report', {
        every: '1h',
        immediate: true,
        run: () =>
          new Promise<void>(resolve => {
            log.push('job start')
            finish = () => {
              log.push('job end')
              resolve()
            }
          })
      })
      await app.start()
      const closed = app.close()
      await vi.waitFor(() => expect(log).toContain('job start'))
      finish()
      await closed
      expect(log).toEqual([
        'mailer start',
        'job start',
        'job end',
        'mailer stop'
      ])
    })

    it('skips the runs of a job that still runs', async () => {
      const app = createJobApp()
      let finish = () => {}
      const run = vi.fn(
        () =>
          new Promise<void>(resolve => {
            finish = resolve
          })
      )
      app.addJob('report', { every: 2, run })
      await app.start()
      await vi.waitFor(() => expect(run).toHaveBeenCalled())
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(run).toHaveBeenCalledOnce()
      finish()
      await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2))
      finish()
      await app.close()
    })

    it('keeps running a job that throws synchronously', async () => {
      const app = createJobApp()
      const run = vi.fn(() => {
        throw new Error('Failed')
      })
      app.addJob('report', { every: 2, run })
      await app.start()
      await vi.waitFor(() => expect(run.mock.calls.length).toBeGreaterThan(1))
      await app.close()
    })

    it('runs a job at its local time on each day', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
      vi.setSystemTime(new Date(2026, 0, 1, 3, 30))
      const app = createJobApp()
      const run = vi.fn()
      app.addJob('report', { at: '03:00', run })
      await app.start()
      await vi.advanceTimersByTimeAsync(23 * 3_600_000)
      expect(run).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(3_600_000)
      expect(run).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(24 * 3_600_000)
      expect(run).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
      await app.close()
    })

    it('takes the form of `addJob()` for the built-in jobs', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
      vi.setSystemTime(new Date(2026, 0, 1, 2, 59))
      const app = createJobApp({ assets: { at: '03:00' } })
      const runJobs = vi.spyOn(app.assets, 'runJobs').mockResolvedValue({
        scan: { rowCount: 0, duration: 0, unreferenced: [], missing: [] },
        released: []
      } as never)
      await app.start()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(runJobs).toHaveBeenCalledOnce()
      vi.useRealTimers()
      await app.close()
    })

    it('logs each failed release of the asset jobs', async () => {
      const { host, user, dbName } = database.orm.config.getAll()
      const entries: unknown[][] = []
      const app = createApp({
        entities,
        database: { host, user, dbName },
        server: { host: '127.0.0.1' },
        logger: {
          hooks: {
            logMethod(args) {
              entries.push(args)
            }
          }
        },
        jobs: { assets: { every: 2 } }
      })
      const error = new Error('Failed')
      vi.spyOn(app.assets, 'runJobs').mockResolvedValue({
        scan: { rowCount: 2, duration: 1, unreferenced: [], missing: [] },
        released: [
          { key: 'a', storage: 'covers' },
          { key: 'b', storage: 'covers', error }
        ]
      } as never)
      await app.start()
      await vi.waitFor(() => expect(entries.length).toBeGreaterThan(1))
      await app.close()
      expect(entries[0]).toEqual([
        'Asset jobs: 2 rows in 1ms, 0 unreferenced, 0 missing, 2 released'
      ])
      expect(entries[1]).toEqual([error, `Unable to release asset 'b'`])
    })

    it('runs no jobs at all with `jobs: false`', async () => {
      const app = createJobApp(false)
      app.createUsers(Admin, {
        session: { cookieName: 'admin.sess', expiresAfter: 60_000 }
      })
      const run = vi.fn()
      app.addJob('report', { every: 2, immediate: true, run })
      const setInterval = vi.spyOn(globalThis, 'setInterval')
      await app.start()
      const { calls } = setInterval.mock
      setInterval.mockRestore()
      await app.close()
      expect(calls).toEqual([])
      expect(run).not.toHaveBeenCalled()
    })

    it('adds each name once, and checks the schedule', async () => {
      const app = createJobApp()
      const run = () => {}
      app.addJob('report', { every: '1h', run })
      expect(() => app.addJob('report', { every: '1h', run })).toThrow(
        `Unable to add job 'report' twice.`
      )
      expect(() => app.addJob('late', { at: '25:00', run })).toThrow(
        `Invalid time of job 'late': '25:00'.`
      )
      expect(() => app.addJob('never', { every: 'soon', run })).toThrow(
        `Invalid duration: 'soon'.`
      )
      expect(() => app.addJob('none', { run } as never)).toThrow(
        `Invalid duration: 'undefined'.`
      )
      await app.close()
    })
  })
})
