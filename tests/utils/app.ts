// tests/utils/app.ts
import os from 'os'
import path from 'path'
import { Application } from '@ditojs/server'
import type { Knex } from 'knex'
import { createPGliteKnex } from './pglite-knex.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestApp = Application & { knex: Knex }

interface TestAppOptions {
  models?: Record<string, any>
  controllers?: Record<string, any>
  admin?: {
    root?: string
    [key: string]: any
  }
  config?: Record<string, any>
  validator?: ConstructorParameters<typeof Application>[0]['validator']
}

export function createTestApp(
  options: TestAppOptions = {}
): TestApp {
  const { knex } = createPGliteKnex()

  const app = new Application({
    config: {
      app: { normalizePaths: true },
      log: { silent: true },
      env: 'development',
      server: { port: 0 },
      knex,
      ...options.config,
      ...(options.admin && {
        admin: {
          ...options.admin
        }
      })
    },
    models: options.models ?? {},
    controllers: options.controllers ?? {},
    ...(options.validator && { validator: options.validator })
  }) as TestApp

  if (options.admin) {
    // Resolve @ditojs/admin and @ditojs/ui from source
    // so no prior build step is needed. Their package
    // exports point to dist/, but in dev we want to use
    // source directly. @ditojs/utils already exports
    // from src/ so no alias needed.
    const pkgs = path.resolve(
      import.meta.dirname, '../../packages'
    )

    // After setup() registers controllers but before
    // the vite dev server starts, build a vite config
    // with our source aliases and make
    // loadAdminViteConfig() return it so
    // setupViteServer() uses it directly.
    app.once('before:start', () => {
      const viteConfig = app.defineAdminViteConfig({
        server: {
          hmr: { port: 0 }
        },
        resolve: {
          alias: [
            {
              find: '@ditojs/admin/style.css',
              replacement: path.join(
                pkgs,
                'admin/src/styles/style.scss'
              )
            },
            {
              find: /^@ditojs\/admin$/,
              replacement: path.join(
                pkgs, 'admin/src/index.js'
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
                pkgs, 'ui/src/index.js'
              )
            },
            {
              find: /^@ditojs\/ui$/,
              replacement: path.join(
                pkgs, 'ui/src/index.js'
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
        cacheDir: path.join(
          os.tmpdir(),
          'dito-e2e-vite-cache',
          // Use the parent directory name so each scenario gets its own
          // cache. `path.basename(appRoot)` is `"app"` for every scenario
          // (each one has `<scenario>/app/`), which collides and forces
          // Vite to re-optimize deps on every fixture run.
          path.basename(path.dirname(options.admin!.root!))
        )
      })
      app.loadAdminViteConfig =
        async () => viteConfig
    })
  }

  return app
}

export function stubSession(app: TestApp) {
  app.use(async (ctx, next) => {
    if (ctx.path === '/api/session') {
      ctx.body = {
        authenticated: true,
        user: { id: 1, name: 'Test' }
      }
      return
    }
    await next()
  })
}

export function getAppUrl(app: TestApp): string {
  const address = app.server?.address?.()
  if (address && typeof address === 'object') {
    return `http://localhost:${address.port}`
  }
  throw new Error('Server not listening')
}
