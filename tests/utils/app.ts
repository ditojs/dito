// tests/utils/app.ts
import path from 'path'
import { Application } from '@ditojs/server'
import type { Knex } from 'knex'
import { createTestKnex } from './test-knex.js'

type TestApp = Application & { knex: Knex }

interface TestAppOptions {
  models?: Record<string, any>
  controllers?: Record<string, any>
  admin?: {
    /** Name of the scenario, used for its Vite cache directory. */
    name: string
    /** Path to the scenario's views module, aliased as `#views`. */
    views: string
    [key: string]: any
  }
  config?: Record<string, any>
  /** Application-level middleware, run after the route is found. */
  middleware?: ConstructorParameters<typeof Application>[0]['middleware']
  validator?: ConstructorParameters<typeof Application>[0]['validator']
}

const adminRoot = path.resolve(import.meta.dirname, 'admin-app')

// Listen on a loopback address and reach the app through it, as other processes
// can bind the port of a server that listens on all addresses to a specific
// address, and then receive its connections.
const host = '127.0.0.1'

export function createTestApp(
  options: TestAppOptions = {}
): TestApp {
  const knex = createTestKnex()

  const app = new Application({
    config: {
      app: {
        normalizePaths: true,
        // Like in development: helmet's default content security policy blocks
        // the admin's vite client, e.g. its websocket.
        helmet: false
      },
      log: { silent: true },
      env: 'development',
      server: { host, port: 0 },
      knex,
      ...options.config,
      ...(options.admin && {
        admin: {
          ...options.admin,
          // All scenarios share one admin entry, which imports `#views`.
          root: adminRoot
        }
      })
    },
    models: options.models ?? {},
    controllers: options.controllers ?? {},
    ...(options.middleware && { middleware: options.middleware }),
    ...(options.validator && { validator: options.validator })
  }) as TestApp

  const { admin } = options
  if (admin) {
    // Resolve @ditojs/admin and @ditojs/ui from source so no prior build step
    // is needed. Their package exports point to dist/, but in dev we want to
    // use source directly. @ditojs/utils already exports from src/ so no alias
    // needed.
    const pkgs = path.resolve(
      import.meta.dirname,
      '../../packages'
    )

    // Build the vite config with our source aliases when the started app sets
    // up its vite dev server.
    app.loadAdminViteConfig = async () =>
      app.defineAdminViteConfig({
        server: {
          // Serve HMR through the app's server, for the same reason as above.
          hmr: { server: app.server! }
        },
        resolve: {
          alias: [
            {
              find: '#views',
              replacement: admin.views
            },
            {
              find: '@ditojs/admin/style.css',
              replacement: path.join(import.meta.dirname, 'admin-style.css')
            },
            {
              find: /^@ditojs\/admin$/,
              replacement: path.join(
                pkgs,
                'admin/src/index.js'
              )
            },
            {
              find: '@ditojs/ui/imports.scss',
              replacement: path.join(
                pkgs,
                'ui/src/styles/_imports.scss'
              )
            },
            {
              find: '@ditojs/ui/src',
              replacement: path.join(
                pkgs,
                'ui/src/index.js'
              )
            },
            {
              find: /^@ditojs\/ui$/,
              replacement: path.join(
                pkgs,
                'ui/src/index.js'
              )
            }
          ]
        },
        css: {
          preprocessorOptions: {
            scss: {
              silenceDeprecations: ['import']
            }
          }
        },
        // Skip the depsOptimizer discovery scan so vite doesn't dispatch
        // background `resolveId`/`load`/`transform` calls during startup.  The
        // scan's in-flight promises aren't canceled by `discover.cancel()` at
        // teardown (vite 8) and stay stuck in `pluginContainer._processesing`,
        // making `pluginContainer.close()` hang indefinitely on workers that
        // never visit /admin/ (e.g. programmatic-only playwright workers).
        // Same workaround vitest applies for tests, see vitest commit e379f64.
        optimizeDeps: { noDiscovery: true, include: [] },
        // Give each checkout, scenario and worker its own cache, as their
        // vite servers optimize dependencies concurrently, and they share the
        // admin root:
        cacheDir: path.resolve(
          import.meta.dirname,
          '../node_modules/.vite-e2e',
          admin.name,
          process.env.TEST_PARALLEL_INDEX ?? '0'
        )
      })
  }

  return app
}

export function stubSession(app: TestApp) {
  const user = { id: 1, name: 'Test' }
  app.use(async (ctx, next) => {
    if (ctx.path === '/api/session') {
      ctx.body = { authenticated: true, user }
      return
    }
    // The user of the account settings:
    if (ctx.path === '/api/self' && ctx.method === 'GET') {
      ctx.body = user
      return
    }
    await next()
  })
}

export function getAppUrl(app: TestApp): string {
  const address = app.server?.address?.()
  if (address && typeof address === 'object') {
    return `http://${host}:${address.port}`
  }
  throw new Error('Server not listening')
}
