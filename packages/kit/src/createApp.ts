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
import { serve, type ServeOptions } from '@ditojs/server/node'
import {
  createMikroAdapter,
  defineMikroConfig,
  getAssetPaths,
  type MikroAdapter
} from '@ditojs/mikro'
import {
  createUsers,
  deleteExpiredSessions,
  type CreateUsersOptions,
  type Users
} from '@ditojs/auth'
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
import { parseDuration } from '@ditojs/utils'
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
  // The jobs that run while the app runs.
  jobs?: JobsOptions
}

export interface JobsOptions {
  // How often to delete the expired sessions, in milliseconds or as a duration
  // such as `'1h'`. The default is `'1h'` once `createUsers()` was called. With
  // `false`, or without users, the job doesn't run.
  sessions?: number | string | false
  // How often to run `assets.runJobs()`, in the same way, but off by default.
  // The logger gets the result of each run.
  assets?: number | string | false
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
  // Starts the jobs and the services in order, then serves `hono` until
  // `close()`, SIGINT or SIGTERM. A failed start stops them and closes the ORM.
  start(options?: { services?: Service[] }): Promise<ServerType>
  // Stops the server, the services and the jobs if they run, then closes the
  // ORM.
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
  jobs = {}
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
    paths: getAssetPaths(entities),
    storages,
    ...assetsOptions
  })
  let hasUsers = false
  let served: Awaited<ReturnType<typeof serve>> | undefined

  return {
    hono,
    orm,
    adapter,
    storages,
    assets,

    get logger() {
      return tryGetContext<DitoEnv>()?.var.logger ?? logger
    },

    createUsers(entity, options) {
      hasUsers = true
      return createUsers(entity, { ...options, adapter, secrets })
    },

    routeApi(path, options) {
      hono.route(path, createApi({ ...options, adapter, onError: logError }))
    },

    async start({ services = [] } = {}) {
      const sessionsJob = createJob(
        jobs.sessions ?? (hasUsers && '1h'),
        logger,
        () => deleteExpiredSessions(adapter)
      )
      const assetsJob = createJob(jobs.assets, logger, async () =>
        logger.info(await assets.runJobs(), 'Asset jobs')
      )
      // The ORM stops last, as services stop in reverse order.
      served = await serve(hono, {
        port,
        host,
        closeTimeout,
        services: [
          { stop: () => orm.close() },
          sessionsJob,
          assetsJob,
          ...services
        ]
      })
      return served.server
    },

    async close() {
      await (served ? served.close() : orm.close())
    }
  }
}

// Run `job` after each interval, unless it still runs. `stop()` waits for it,
// as the ORM closes after the jobs.
function createJob(
  every: number | string | false | undefined,
  logger: Logger,
  job: () => unknown
): Service {
  const interval = every ? parseDuration(every) : 0
  let timer: ReturnType<typeof setInterval> | undefined
  let running: Promise<void> | undefined
  const run = async () => {
    try {
      await job()
    } catch (error) {
      logger.error(error)
    }
  }
  return {
    start() {
      if (interval) {
        timer = setInterval(() => {
          running ??= run().finally(() => {
            running = undefined
          })
        }, interval)
      }
    },

    async stop() {
      clearInterval(timer)
      await running
    }
  }
}
