import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import type { HttpBindings } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response'
import type { InlineConfig, ViteDevServer } from 'vite'
import { asArray, assignDeeply, isArray, isString } from '@ditojs/utils'
import { isAuthorized, type Authorize, type User } from '@ditojs/server'
import { normalizeBase } from './normalizeBase.ts'

// The admin as a Hono app, for the host to mount with `app.route(base, admin)`.

export interface CreateAdminOptions {
  // The path the admin is served at, such as `/admin`.
  base: string
  // The built admin, served without `vite`.
  dist?: string
  // `dito.api` in the browser, such as `url` and `users`.
  api?: Record<string, unknown>
  // `dito.settings` in the browser.
  settings?: Record<string, unknown>
  // Middleware that `getUser` and `authorize` need, such as the session
  // middleware. It runs only on the requests that `authorize` checks.
  middleware?: MiddlewareHandler | MiddlewareHandler[]
  // The signed-in user of the request, or null. `authorize` reads it as
  // `c.var.user`.
  getUser?: (context: { c: Context }) => User | null | Promise<User | null>
  // Who may load the files below `views/`, as in `createApi()`: `true` for
  // anyone, a role or a list of roles, of which the user needs one, or a
  // function of `c`. Denied requests get 401, or 403 with a user. Without it,
  // anyone may.
  authorize?: Authorize
  // The Vite config of development, or the path of its file, such as one
  // that exports `defineAdminViteConfig()` from `@ditojs/admin/vite`.
  // With it, Vite serves the admin's sources, which needs the Node server of
  // `@hono/node-server`. Vite's own urls, such as `/@fs/`, stay open, so only
  // use it in development. The HMR websocket listens on its `server.port`, by
  // default a free one.
  vite?: InlineConfig | string
}

interface AdminEnv {
  Variables: { user: User | null }
}

export type AdminServer = Hono<AdminEnv> & {
  // Stops Vite in development.
  close: () => Promise<void>
}

export function createAdmin(options: CreateAdminOptions): AdminServer {
  const { middleware, getUser, authorize, api = {}, settings = {} } = options
  const base = normalizeBase(options.base)
  const isProtected = authorize !== undefined && authorize !== true
  // Without `getUser`, there is no user whose roles could match.
  if (!getUser && (isString(authorize) || isArray(authorize))) {
    throw new Error('Unable to check the roles of the admin without `getUser`.')
  }
  const getFilePath = (pathname: string) => pathname.slice(base.length)
  const app = new Hono<AdminEnv>()
  let close = async () => {}

  const dito = { base, api, settings }
  const script = `window.dito = ${JSON.stringify(dito, null, 2)}`
  app.get(
    '/dito.js',
    () =>
      new Response(script, {
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'text/javascript; charset=utf-8'
        }
      })
  )
  if (isProtected) {
    // Case-insensitive file systems serve the views in any case, and Windows
    // also as `views.` or `views::$INDEX_ALLOCATION`, which the route of
    // `authorize` doesn't match.
    app.use('*', async (c, next) => {
      const file = getFilePath(c.req.path)
      if (viewsPathPattern.test(file) && !file.startsWith('/views/')) {
        return c.text('Not Found', 404)
      }
      await next()
    })
    app.use('/views/*', ...asArray(middleware), async (c, next) => {
      const user = (await getUser?.({ c })) ?? null
      c.set('user', user)
      if (await isAuthorized(c, authorize)) return next()
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
    if (!options.dist) {
      throw new Error('Unable to serve the admin without `vite` or `dist`.')
    }
    const root = path.resolve(options.dist)
    app.get(
      '*',
      async (c, next) => {
        await next()
        // Hashed build files never change, and shared caches don't keep
        // protected views. Set it here, as `onFound` of `serveStatic()` runs
        // too late for headers.
        const file = getFilePath(c.req.path)
        c.header(
          'Cache-Control',
          c.res.status === 200 && buildFilePattern.test(file)
            ? isProtected && viewsPathPattern.test(file)
              ? 'private, max-age=31536000, immutable'
              : 'public, max-age=31536000, immutable'
            : 'no-cache'
        )
      },
      serveStatic({
        root,
        // Paths of other files than scripts and styles are routes of the
        // admin, unless the file exists.
        rewriteRequestPath: pathname => {
          const file = getFilePath(pathname)
          const stats = fs.statSync(path.join(root, file), {
            throwIfNoEntry: false
          })
          return stats?.isFile() || /\.(js|css)$/.test(file)
            ? file
            : '/index.html'
        }
      })
    )
  }

  return Object.assign(app, { close })
}

const buildFilePattern = /^\/(assets|views)\/[^/]+\.\w+$/
// With the `u` flag, it also matches the `ſ` that file systems read as `s`.
const viewsPathPattern = /^\/views[/.:]/iu

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
          // Watch the Dito.js packages, although they're in `node_modules`.
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
