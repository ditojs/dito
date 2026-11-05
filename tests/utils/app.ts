// tests/utils/app.ts
import type http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { Hono, type MiddlewareHandler } from 'hono'
import { createAdaptorServer } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import {
  createApi,
  createErrorHandler,
  notFound,
  type ControllerDefinition,
  type DitoContext,
  type Middleware,
  type User
} from '@ditojs/server'
import { mikroDb } from '@ditojs/mikro'
import type { Options } from '@mikro-orm/postgresql'
import {
  createAdmin,
  type AdminServer,
  type AuthenticationFeatures
} from '@ditojs/admin-server'
import { defineAdminViteConfig } from '@ditojs/admin-server/vite'
import { createTestDatabase, type TestOrm } from './database.js'

// A test app: the entities on a test database of their own, the Dito API of
// their controllers at `prefix`, the admin at `/admin` in Vite's development
// mode, and a Node server that hosts them. The `handlers` are Hono middleware
// that run first and answer other paths, such as stored files. `start()`
// listens on a free port of the loopback address. `stop()` also drops the
// database.

// What the Dito API at `prefix` serves.
export interface TestApi {
  controllers: ControllerDefinition[]
  middleware?: Middleware[]
  getUser?: (c: DitoContext) => User | null | Promise<User | null>
  // The features of `usersRoutes()`, which the admin offers.
  authentication?: AuthenticationFeatures
}

export interface TestAppOptions {
  entities?: Options['entities']
  api?: (orm: TestOrm) => TestApi
  // The path of the API, `/api` by default, or an empty string for the root.
  prefix?: string
  admin?: {
    // The name of the scenario, for its Vite cache directory.
    name: string
    // The scenario's views module, aliased as `#views`.
    views: string
    // `dito.api` in the browser.
    api?: Record<string, unknown>
  }
  handlers?: MiddlewareHandler[]
  host?: string
  port?: number
}

export interface TestApp {
  // The ORM of the entities, or null without entities.
  orm: TestOrm | null
  // The Hono app of the handlers, the admin and the API.
  app: Hono
  authentication: AuthenticationFeatures | undefined
  server: http.Server | null
  // The URL of the started app.
  url: string | null
  // Logs the errors that answer 500 or above, which tests that cause them on
  // purpose turn off.
  logErrors: boolean
  // Resolves to the URL of the app.
  start(): Promise<string>
  stop(): Promise<void>
}

const adminRoot = path.resolve(import.meta.dirname, 'admin-app')

// Listen on a loopback address and reach the app through it, as other processes
// can bind the port of a server that listens on all addresses to a specific
// address, and then receive its connections.
const defaultHost = '127.0.0.1'

export async function createTestApp(
  options: TestAppOptions = {}
): Promise<TestApp> {
  const {
    entities = [],
    handlers = [],
    prefix = '/api',
    host = defaultHost,
    port = 0
  } = options
  const database = entities.length ? await createTestDatabase(entities) : null
  const orm = database?.orm ?? null
  const {
    controllers = [],
    middleware = [],
    getUser,
    authentication
  } = options.api?.(orm!) ?? {}

  const logError = (error: unknown) => {
    if (testApp.logErrors) console.error(error)
  }
  const app = new Hono()
  app.onError(createErrorHandler({ onError: logError }))
  if (handlers.length) app.use(...handlers)

  let admin: AdminServer | null = null
  if (options.admin) {
    const { name, views, api } = options.admin
    const vite = await getViteConfig(name, views)
    admin = createAdmin({
      base: '/admin',
      api: { url: `${prefix}/`, ...api },
      authentication,
      vite
    })
    app.route('/admin', admin)
  }

  app.route(
    prefix || '/',
    createApi({
      controllers,
      middleware,
      ...(orm && { db: mikroDb(orm) }),
      getUser,
      onError: logError
    })
  )
  app.notFound(notFound)

  const testApp: TestApp = {
    orm,
    app,
    authentication,
    server: null,
    url: null,
    logErrors: true,
    start,
    stop
  }

  async function start() {
    const server = createAdaptorServer({ fetch: app.fetch }) as http.Server
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, () => resolve())
    })
    testApp.server = server
    const { port: actualPort } = server.address() as AddressInfo
    testApp.url = `http://${host}:${actualPort}`
    return testApp.url
  }

  async function stop() {
    const { server } = testApp
    if (server) {
      // Closes the open connections too, such as the browser's.
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
      testApp.server = null
      testApp.url = null
    }
    await admin?.close()
    await database?.drop()
  }

  return testApp
}

// The Vite config of the admin, with the scenario's views as `#views`.
async function getViteConfig(name: string, views: string) {
  const config = await defineAdminViteConfig(
    { root: adminRoot, base: '/admin', mode: 'development' },
    {
      css: {
        preprocessorOptions: {
          scss: {
            silenceDeprecations: ['import']
          }
        }
      },
      // Skip the depsOptimizer discovery scan so vite doesn't dispatch
      // background `resolveId`/`load`/`transform` calls during startup. The
      // scan's in-flight promises aren't canceled by `discover.cancel()` at
      // teardown (vite 8) and make `pluginContainer.close()` hang on workers
      // that never visit /admin/, such as programmatic-only workers. Vitest
      // does the same for tests, see vitest commit e379f64.
      optimizeDeps: { noDiscovery: true, include: [] },
      // Each checkout, scenario and worker has its own cache, as their Vite
      // servers optimize dependencies concurrently, and they share the admin
      // root.
      cacheDir: path.resolve(
        import.meta.dirname,
        '../node_modules/.vite-e2e',
        name,
        process.env.TEST_PARALLEL_INDEX ?? '0'
      )
    }
  )
  const alias = config.resolve!.alias as { find: string; replacement: string }[]
  alias.push({ find: '#views', replacement: views })
  return config
}

// Answers the own user as logged in, for scenarios without users of their
// own.
export function stubSession(): MiddlewareHandler {
  const user = { id: 1, username: 'test', name: 'Test' }
  return async (c, next) => {
    const { path, method } = c.req
    if (path === '/api/self' && method === 'GET') return c.json(user)
    await next()
  }
}

// Serves the files of `folder` at `prefix`, such as `/uploads`.
export function serveFolder(prefix: string, folder: string): MiddlewareHandler {
  const serve = serveStatic({
    root: folder,
    rewriteRequestPath: pathname => pathname.slice(prefix.length)
  })
  return (c, next) =>
    c.req.path.startsWith(`${prefix}/`) ? serve(c, next) : next()
}

export function getAppUrl(app: TestApp): string {
  if (!app.url) throw new Error('Server not listening')
  return app.url
}
