import type { Hono } from 'hono'
import { contextStorage, tryGetContext } from 'hono/context-storage'
import type { ServerType } from '@hono/node-server'
import pino, { type Logger, type LoggerOptions } from 'pino'
import { MikroORM, type EntityClass, type Options } from '@mikro-orm/postgresql'
import {
  createApi,
  createHono,
  type CreateApiOptions,
  type CreateHonoOptions,
  type DitoEnv,
  type Service,
  type User
} from '@ditojs/server'
import { serve, startServices, type ServeOptions } from '@ditojs/server/node'
import {
  createMikroAdapter,
  defineMikroConfig,
  getAssetFields,
  type MikroAdapter
} from '@ditojs/mikro'
// Types `em` in the apps of the kit, which all run on MikroORM.
import '@ditojs/mikro/types'
import { createUsers, type CreateUsersOptions, type Users } from '@ditojs/auth'
import { deleteExpiredSessions } from '@ditojs/auth/internal'
import {
  createAdmin,
  type AdminServer,
  type CreateAdminOptions
} from '@ditojs/admin/server'
import {
  createAssets,
  createStorages,
  DiskStorage,
  type Assets,
  type CreateAssetsOptions,
  type StorageDefinition,
  type StorageRegistry
} from '@ditojs/storage'
import { serveStorage } from '@ditojs/storage/node'
import { isNumber, isString, parseDuration } from '@ditojs/utils'
import { createRequestLogger } from './createRequestLogger.ts'

export interface CreateAppOptions {
  // The entities, as a list or a module of them.
  entities: object
  // The options of MikroORM, such as `dbName`, `host`, `user` and `password`.
  database: Omit<Options, 'entities'>
  // The `port`, `host` and `closeTimeout` of `serve()`, and the options of
  // `createHono()`.
  server?: Omit<ServeOptions, 'services'> &
    Omit<CreateHonoOptions, 'onError' | 'middleware'>
  // The options of pino. The logs have no pid and hostname by default.
  logger?: LoggerOptions
  // The secrets that sign the cookies and the password reset links.
  secrets?: string[]
  // The definitions of `createStorages()`. A disk storage is served at the path
  // of its `url`. A `url` without a path, such as a host of its own, isn't.
  storages?: Record<string, StorageDefinition>
  assets?: Pick<CreateAssetsOptions, 'deleteUnusedAfter' | 'maxSize'>
  // The built-in jobs. With `false`, no jobs run at all, also not those of
  // `addJob()`, such as in tests.
  jobs?: JobsOptions | false
}

// When a job runs. `every` is in milliseconds or a duration such as `'1h'`, and
// the first run comes one interval after the start, or at the start with
// `immediate`. `at` is a time of each day, in local time, such as `'03:00'`.
export type JobSchedule =
  | { every: number | string; immediate?: boolean; at?: never }
  | { at: string; every?: never; immediate?: never }

export type JobDefinition = JobSchedule & { run: () => unknown }

// A built-in job: a duration, or a schedule. `false` turns it off.
type BuiltInJob = number | string | JobSchedule | false

export interface JobsOptions {
  // Deletes the expired sessions. Once `createUsers()` was called, the default
  // is `'1h'`. Without users, the job doesn't run.
  sessions?: BuiltInJob
  // Runs `assets.runJobs()`, and logs a summary of each run. Off by default.
  assets?: BuiltInJob
}

export interface App {
  // The Hono app, for the app's own middleware and routes.
  hono: Hono
  orm: MikroORM
  adapter: MikroAdapter
  // The logger of the current request, with its id, else the app's.
  logger: Logger
  storages: StorageRegistry
  assets: Assets
  // The services by name, such as `app.services.mailer`.
  services: Record<string, any>
  // True from after the services start until a shutdown has ended all requests,
  // so that work that outlives them can fail with a clear message.
  readonly isRunning: boolean
  // Users of an entity on the app's database, signed with its secrets.
  createUsers<U extends User>(
    entity: EntityClass<U>,
    options: Omit<CreateUsersOptions<U>, 'adapter' | 'secrets'>
  ): Users<U>
  // Routes an API on the app's database.
  routeApi(
    path: string,
    options: Omit<CreateApiOptions, 'adapter' | 'onError'>
  ): void
  // Routes the admin at `path`, which is its `base`. `close()` stops it.
  routeAdmin(path: string, options: Omit<CreateAdminOptions, 'base'>): void
  // Adds a service. Services start in this order and stop in reverse order.
  addService(name: string, service: Service): void
  // Adds a job, which starts after the services and stops before them. A job
  // that still runs skips its next run, and `close()` waits for it. Its errors
  // go to the logger.
  addJob(name: string, definition: JobDefinition): void
  // Starts the services alone, for scripts, until `close()`. A failed start
  // stops them and closes the ORM.
  startServices(): Promise<void>
  // Starts the services and the jobs, then serves `hono` until `close()`,
  // SIGINT or SIGTERM. A failed start stops them and closes the ORM.
  start(): Promise<ServerType>
  // Stops what runs, then closes the ORM.
  close(): Promise<void>
}

// Logs through the logger of the request, so that errors have its id.
const logError: CreateApiOptions['onError'] = ({ error, c }) =>
  c.var.logger.error(error)

export function createApp({
  entities,
  database,
  server: { port, host, closeTimeout, ...honoOptions } = {},
  logger: loggerOptions,
  secrets = [],
  storages: definitions = {},
  assets: assetsOptions,
  jobs: jobsOptions = {}
}: CreateAppOptions): App {
  const logger = pino({ base: null, ...loggerOptions })
  const orm = new MikroORM(defineMikroConfig({ ...database, entities }))
  const adapter = createMikroAdapter(orm)
  const storages = createStorages(definitions)
  const hono = createHono({
    ...honoOptions,
    onError: logError,
    middleware: [contextStorage(), createRequestLogger(logger)]
  })
  for (const storage of storages.values()) {
    if (storage instanceof DiskStorage && storage.url) {
      const { pathname } = new URL(storage.url, 'http://localhost')
      if (pathname !== '/') {
        hono.use(`${pathname.replace(/\/$/, '')}/*`, serveStorage(storage))
      }
    }
  }
  const assets = createAssets({
    adapter,
    fields: getAssetFields(entities),
    storages,
    ...assetsOptions
  })
  const services: App['services'] = {}
  const jobs: Record<string, Service> = {}
  const admins: AdminServer[] = []
  const { sessions: sessionsJob = '1h', assets: assetsJob = false } = (
    jobsOptions || {}
  )
  let isRunning = false

  // Vite runs from `routeAdmin()` on, also in apps that never start.
  const closeResources = async () => {
    for (const admin of admins) await admin.stop()
    await orm.close()
  }

  let stop = closeResources
  // The resources close with the app, so it can't start again.
  let hasStarted = false
  const setStarted = () => {
    if (hasStarted) throw new Error('Unable to start the app twice.')
    hasStarted = true
  }

  const addJob: App['addJob'] = (name, definition) => {
    if (Object.hasOwn(jobs, name)) {
      throw new Error(`Unable to add job '${name}' twice.`)
    }
    jobs[name] = createJob(name, definition, logger)
  }

  const addBuiltInJob = (
    name: string,
    job: BuiltInJob,
    run: JobDefinition['run']
  ) => {
    if (job !== false) {
      const schedule = isNumber(job) || isString(job) ? { every: job } : job
      addJob(name, { ...schedule, run })
    }
  }

  addBuiltInJob('assets', assetsJob, async () => {
    const { scan, released } = await assets.runJobs()
    logger.info(
      `Asset jobs: ${scan.rowCount} rows in ${scan.duration}ms, ` +
      `${scan.unreferenced.length} unreferenced, ` +
      `${scan.missing.length} missing, ${released.length} released`
    )
    for (const { key, error } of released) {
      if (error) logger.error(error, `Unable to release asset '${key}'`)
    }
  })

  // The resources close last, as services stop in reverse order.
  const getServices = (): Service[] => [
    { stop: closeResources },
    ...Object.values<Service>(services),
    {
      start() {
        isRunning = true
      },
      stop() {
        isRunning = false
      }
    }
  ]

  return {
    hono,
    orm,
    adapter,
    storages,
    assets,
    services,

    get logger() {
      return tryGetContext<DitoEnv>()?.var.logger ?? logger
    },

    get isRunning() {
      return isRunning
    },

    createUsers(entity, options) {
      if (!Object.hasOwn(jobs, 'sessions')) {
        addBuiltInJob('sessions', sessionsJob, () =>
          deleteExpiredSessions(adapter)
        )
      }
      return createUsers(entity, { ...options, adapter, secrets })
    },

    routeApi(path, options) {
      hono.route(path, createApi({ ...options, adapter, onError: logError }))
    },

    routeAdmin(path, options) {
      const admin = createAdmin({ ...options, base: path })
      hono.route(path, admin)
      admins.push(admin)
    },

    addService(name, service) {
      if (Object.hasOwn(services, name)) {
        throw new Error(`Unable to add service '${name}' twice.`)
      }
      services[name] = service
    },

    addJob,

    async startServices() {
      setStarted()
      stop = await startServices(getServices())
    },

    async start() {
      setStarted()
      const served = await serve(hono, {
        port,
        host,
        closeTimeout,
        services: [
          ...getServices(),
          ...(jobsOptions ? Object.values(jobs) : [])
        ]
      })
      stop = served.close
      return served.server
    },

    close() {
      return stop()
    }
  }
}

// Run the job on its schedule, unless it still runs. `stop()` waits for it, as
// the services stop after the jobs.
function createJob(
  name: string,
  { every, at, immediate, run }: JobDefinition,
  logger: Logger
): Service {
  if (at && !timePattern.test(at)) {
    throw new Error(`Invalid time of job '${name}': '${at}'.`)
  }
  const interval = at ? 0 : parseDuration(every!)
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined

  const execute = async () => {
    try {
      await run()
    } catch (error) {
      logger.error(error, `Job '${name}' failed`)
    }
  }

  const runJob = () => {
    running ??= execute().finally(() => {
      running = undefined
    })
  }

  const scheduleRun = (time: string, after: Date) => {
    const next = getNextTime(time, after)
    timer = setTimeout(() => {
      runJob()
      scheduleRun(time, next)
    }, next.getTime() - Date.now())
  }

  return {
    start() {
      if (at) {
        scheduleRun(at, new Date())
      } else {
        if (immediate) runJob()
        timer = setInterval(runJob, interval)
      }
    },

    async stop() {
      clearTimeout(timer)
      await running
    }
  }
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

// The next local time after `after`. Each day is built from its date, so that
// runs keep their time across daylight saving changes.
function getNextTime(time: string, after: Date) {
  const [hours, minutes] = time.split(':').map(Number)
  const getTime = (date: number) =>
    new Date(after.getFullYear(), after.getMonth(), date, hours, minutes)
  const today = getTime(after.getDate())
  return today > after ? today : getTime(after.getDate() + 1)
}
