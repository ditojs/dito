import type { Hono } from 'hono'
import { contextStorage, tryGetContext } from 'hono/context-storage'
import type { ServerType } from '@hono/node-server'
import pino, { type Logger, type LoggerOptions } from 'pino'
import { MikroORM, type Options } from '@mikro-orm/postgresql'
import {
  createApi,
  createHono,
  type ApiConfig,
  type CreateHonoOptions,
  type Service
} from '@ditojs/server'
import { serve, type ServeOptions } from '@ditojs/server/node'
import {
  createMikroAdapter,
  defineMikroConfig,
  getAssetPaths
} from '@ditojs/mikro'
import {
  createSessions,
  type CreateSessionsOptions,
  type Sessions
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
import { createRequestLogger } from './createRequestLogger.ts'

export interface CreateAppOptions {
  // The entities, as a list or a module of them.
  entities: object
  // The options of MikroORM, such as `dbName`, `host`, `user` and `password`.
  database: Omit<Options, 'entities'>
  // The `port`, `host` and `closeTimeout` of `serve()`.
  server?: Omit<ServeOptions, 'services'>
  // The options of `createHono()`.
  http?: Omit<CreateHonoOptions, 'onError' | 'middleware'>
  // The options of pino. The logs have no pid and hostname by default.
  logger?: LoggerOptions
  // The secrets that sign the cookies of the sessions.
  secrets?: string[]
  // The definitions of `createStorages()`. A disk storage is served at the path
  // of its `url`. A `url` without a path, such as a host of its own, isn't.
  storages?: Record<string, StorageDefinition>
  assets?: Pick<CreateAssetsOptions, 'deleteUnusedAfter'>
}

export interface App {
  // The Hono app, for the app's own middleware and routes.
  hono: Hono
  orm: MikroORM
  adapter: ReturnType<typeof createMikroAdapter>
  // The logger of the current request, with its id, else the app's.
  logger: Logger
  storages: StorageRegistry
  assets: Assets
  // Sessions on the app's database, signed with its secrets.
  createSessions(
    options: Omit<CreateSessionsOptions, 'adapter' | 'secrets'>
  ): Sessions
  // Routes an API on the app's database.
  routeApi(path: string, options: Omit<ApiConfig, 'adapter' | 'onError'>): void
  // Starts the services in order, then serves `hono` until `close()`, SIGINT or
  // SIGTERM.
  start(options?: { services?: Service[] }): Promise<ServerType>
  // Stops the server and the services if they run, then closes the ORM.
  close(): Promise<void>
}

// Logs through the logger of the request, so that errors have its id.
const logError: ApiConfig['onError'] = ({ error, c }) =>
  c.var.logger.error(error)

export function createApp({
  entities,
  database,
  server,
  http,
  logger: loggerOptions,
  secrets = [],
  storages: definitions = {},
  assets: assetsOptions
}: CreateAppOptions): App {
  const logger = pino({ base: null, ...loggerOptions })
  const orm = new MikroORM(defineMikroConfig({ ...database, entities }))
  const adapter = createMikroAdapter(orm)
  const storages = createStorages(definitions)
  const hono = createHono({
    ...http,
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
  let served: Awaited<ReturnType<typeof serve>> | undefined

  return {
    hono,
    orm,
    adapter,
    storages,
    assets: createAssets({
      adapter,
      paths: getAssetPaths(entities),
      storages,
      ...assetsOptions
    }),

    get logger() {
      return tryGetContext()?.var.logger ?? logger
    },

    createSessions: options => createSessions({ ...options, adapter, secrets }),

    routeApi(path, options) {
      hono.route(path, createApi({ ...options, adapter, onError: logError }))
    },

    async start({ services = [] } = {}) {
      // The ORM stops last, as services stop in reverse order.
      served = await serve(hono, {
        ...server,
        services: [{ stop: () => orm.close() }, ...services]
      })
      return served.server
    },

    async close() {
      await (served ? served.close() : orm.close())
    }
  }
}
