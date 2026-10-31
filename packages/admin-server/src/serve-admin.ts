import path from 'node:path'
import type { InlineConfig } from 'vite'
import { normalizeBase } from './base.ts'
import { notFound, serveFiles } from './serve-files.ts'

// Serves the Dito admin under `base`: the built files from `dist` in
// production, and the sources in `root` through Vite's dev server in
// development. Only development imports `./vite.ts`, and with it Vite. Both
// modes send the `dito` object to the browser as `dito.js`. `fetch()` takes
// requests with `base` in their paths and answers 404 to others, so the app
// passes it `base` and everything below.

export interface AdminOptions {
  // The path the admin is served at, such as `/admin`.
  base: string
  mode?: 'production' | 'development'
  // The built admin, for production.
  dist?: string
  // The admin's sources, for development.
  root?: string
  // `dito.api` in the browser, such as `url` and `users`.
  api?: Record<string, unknown>
  // `dito.settings` in the browser.
  settings?: Record<string, unknown>
  // `dito.authentication`: the `features` of `usersRoutes()`.
  authentication?: AuthenticationFeatures
  // Whether the request may load the admin's views. Denied requests get 401.
  authorize?: (request: Request) => boolean | Promise<boolean>
  // The Vite config in development, by default `defineAdminViteConfig()` of
  // `root` and `base`, from `@ditojs/admin-server/vite`. Vite listens on its
  // `server.host`, by default `127.0.0.1`, and its `server.port`, by default a
  // free one. The browser opens the HMR websocket there.
  vite?: InlineConfig
}

export interface AuthenticationFeatures {
  hasPasskeys: boolean
  hasTotp: boolean
  hasPasswordChange: boolean
  hasPasswordReset: boolean
}

export interface AdminServer {
  fetch: (request: Request) => Promise<Response>
  // Stops Vite in development.
  close: () => Promise<void>
}

export function serveAdmin(options: AdminOptions): AdminServer {
  const { mode = 'production', authorize } = options
  const base = normalizeBase(options.base)
  const config = getConfigScript(base, options)
  let handle: (request: Request, pathname: string) => Promise<Response>
  let close = async () => {}

  if (mode === 'development') {
    if (!options.root) {
      throw new Error('serveAdmin() needs `root` in development mode.')
    }
    const { root, vite: viteConfig } = options
    const vite = import('./vite.ts').then(
      ({ startVite, defineAdminViteConfig }) =>
        startVite(
          viteConfig
            ? Promise.resolve(viteConfig)
            : defineAdminViteConfig({ root, base, mode: 'development' })
        )
    )
    // A failed import reaches the requests through `await vite`.
    vite.catch(() => {})
    // Vite only serves `base` with its trailing slash.
    handle = async (request, pathname) =>
      (await vite).fetch(request, pathname === base ? `${base}/` : pathname)
    close = async () => {
      const server = await vite.catch(() => null)
      await server?.close()
    }
  } else {
    if (!options.dist) {
      throw new Error('serveAdmin() needs `dist` in production mode.')
    }
    const files = serveFiles(base, path.resolve(options.dist))
    handle = (request, pathname) =>
      request.method === 'GET' || request.method === 'HEAD'
        ? files(request, pathname)
        : Promise.resolve(methodNotAllowed())
  }

  return {
    async fetch(request) {
      const { pathname } = new URL(request.url)
      if (pathname !== base && !pathname.startsWith(`${base}/`)) {
        return notFound()
      }
      if (pathname === `${base}/dito.js`) return config()
      if (
        authorize &&
        /\/views\b/.test(pathname) &&
        !(await authorize(request))
      ) {
        return new Response('Unauthorized', {
          status: 401,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        })
      }
      return handle(request, pathname)
    },
    close
  }
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

function methodNotAllowed() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      'Allow': 'GET, HEAD',
      'Content-Type': 'text/plain; charset=utf-8'
    }
  })
}
