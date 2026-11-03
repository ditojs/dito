import path from 'node:path'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import type { HttpBindings } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response'
import type { InlineConfig, ViteDevServer } from 'vite'
import { asArray, assignDeeply, isFunction, isString } from '@ditojs/utils'
import { normalizeBase } from './normalize-base.ts'

// Serves the Dito admin as a Hono app, which the host routes at `base` with
// `app.route(base, admin)`. It serves the built files from `dist`, or with a
// `vite` config the sources through Vite, which needs the Node server of
// `@hono/node-server`. `middleware`, `getUser` and `authorize` work as in
// `createApi()`, and protect the files below `views/` in both modes.

export interface AdminOptions {
  // The path the admin is served at, such as `/admin`.
  base: string
  // The built admin, served without `vite`.
  dist?: string
  // `dito.api` in the browser, such as `url` and `users`.
  api?: Record<string, unknown>
  // `dito.settings` in the browser.
  settings?: Record<string, unknown>
  // `dito.authentication`: the `features` of `usersRoutes()`.
  authentication?: AuthenticationFeatures
  // Middleware that `getUser` and `authorize` need, such as the session
  // middleware. It runs only on the requests that `authorize` checks.
  middleware?: MiddlewareHandler | MiddlewareHandler[]
  // The signed-in user of the request, or null. `authorize` reads it as
  // `c.var.user`.
  getUser?: (c: Context) => AdminUser | null | Promise<AdminUser | null>
  // Who may load the admin's views: `true` for anyone, a role or a list of
  // roles, of which the user needs one, or a function of `c`. Denied requests
  // get 401, or 403 with a user. Without it, anyone may.
  authorize?: AdminAuthorize
  // The Vite config of development, or the path of its file, such as one
  // that exports `defineAdminViteConfig()` from `@ditojs/admin-server/vite`.
  // With it, Vite serves the admin's sources. The HMR websocket listens on
  // its `server.port`, by default a free one.
  vite?: InlineConfig | string
}

export interface AdminUser {
  roles: string[]
}

export type AdminAuthorize =
  | true
  | string
  | string[]
  | ((c: Context) => boolean | Promise<boolean>)

export interface AuthenticationFeatures {
  hasPasskeys: boolean
  hasTotp: boolean
  hasPasswordChange: boolean
  hasPasswordReset: boolean
}

interface AdminEnv {
  Variables: { user: AdminUser | null }
}

export type AdminServer = Hono<AdminEnv> & {
  // Stops Vite in development.
  close: () => Promise<void>
}

export function serveAdmin(options: AdminOptions): AdminServer {
  const { middleware, getUser, authorize } = options
  const base = normalizeBase(options.base)
  const app = new Hono<AdminEnv>()
  let close = async () => {}

  app.get('/dito.js', getConfigScript(base, options))
  if (authorize !== undefined && authorize !== true) {
    // Case-insensitive file systems serve the views in any case, which the
    // route of `authorize` doesn't match.
    app.use('*', async (c, next) => {
      const file = c.req.path.slice(base.length)
      if (viewsPath.test(file) && !file.startsWith('/views/')) {
        return c.text('Not Found', 404)
      }
      await next()
    })
    app.use('/views/*', ...asArray(middleware), async (c, next) => {
      const user = (await getUser?.(c)) ?? null
      c.set('user', user)
      const isAuthorized = isFunction(authorize)
        ? await authorize(c)
        : !!user && asArray(authorize).some(role => user.roles.includes(role))
      if (isAuthorized) return next()
      return user ? c.text('Forbidden', 403) : c.text('Unauthorized', 401)
    })
  }

  if (options.vite) {
    const vite = startVite(options.vite)
    // A failed start reaches the requests through `await vite`.
    vite.catch(() => {})
    app.all('*', async c => {
      const { incoming, outgoing } = c.env as HttpBindings
      // Vite only serves `base` with its trailing slash.
      if (c.req.path === base) {
        incoming.url = `${base}/${new URL(c.req.url).search}`
      }
      ;(await vite).middlewares(incoming, outgoing)
      return RESPONSE_ALREADY_SENT
    })
    close = async () => {
      await (await vite.catch(() => null))?.close()
    }
  } else {
    app.get(
      '*',
      async (c, next) => {
        await next()
        // The build's files never change, as their names hold their hash.
        // The others are checked again on each load. `onFound` of
        // `serveStatic()` can't set headers, as it runs after the response is
        // created.
        c.header(
          'Cache-Control',
          buildFile.test(c.req.path.slice(base.length))
            ? 'public, max-age=31536000, immutable'
            : 'no-cache'
        )
      },
      serveStatic({
        root: path.resolve(options.dist!),
        // Paths without an extension are routes of the admin.
        rewriteRequestPath: pathname => {
          const file = pathname.slice(base.length)
          return path.extname(file) ? file : '/index.html'
        }
      })
    )
  }

  return Object.assign(app, { close })
}

const buildFile = /^\/(assets|views)\/[^/]+\.\w+$/
// With the `u` flag, it also matches the `ſ` that file systems read as `s`.
const viewsPath = /^\/views\//iu

async function startVite(
  configOrFile: InlineConfig | string
): Promise<ViteDevServer> {
  const { createServer, loadConfigFromFile } = await import('vite')
  const config = isString(configOrFile)
    ? {
        ...(await loadConfigFromFile(
          { command: 'serve', mode: 'development' },
          path.resolve(configOrFile),
          undefined,
          undefined,
          undefined,
          'native'
        ))!.config,
        configFile: false as const
      }
    : configOrFile
  const port = config.server?.port ?? (await getFreePort())
  return createServer(
    assignDeeply(
      {
        server: {
          // Watches the Dito.js packages, although they're in `node_modules`.
          watch: { ignored: ['!**/node_modules/@ditojs/**'] }
        }
      },
      config,
      {
        server: {
          middlewareMode: true,
          // The client uses `ws` unless Vite runs on HTTPS, also on pages
          // served over HTTPS.
          ws: { port, protocol: config.server?.https ? 'wss' : 'ws' }
        }
      }
    ) as InlineConfig
  )
}

function getFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.on('error', reject)
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo
      server.close(() => resolve(port))
    })
  })
}

function getConfigScript(base: string, options: AdminOptions) {
  const {
    api = {},
    settings = {},
    authentication = {
      hasPasskeys: false,
      hasTotp: false,
      hasPasswordChange: false,
      hasPasswordReset: false
    }
  } = options
  const dito = { base, api, settings, authentication }
  const code = `window.dito = ${JSON.stringify(dito, null, 2)}`
  return () =>
    new Response(code, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/javascript; charset=utf-8'
      }
    })
}
