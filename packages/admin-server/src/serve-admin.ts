import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import type { Server } from 'node:http'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { getMimeType } from 'hono/utils/mime'
import type { HttpBindings } from '@hono/node-server'
import type { InlineConfig, ViteDevServer } from 'vite'
import { assignDeeply } from '@ditojs/utils'
import { normalizeBase } from './base.ts'
import { defineAdminViteConfig } from './vite-config.ts'

// Serves the Dito admin under `base`: the built files from `dist` in
// production, and the sources in `root` through Vite in development. Both
// modes send the `dito` object to the browser as `dito.js`. The returned app
// carries `base` in its routes, so the app mounts it at `/`. Development mode
// needs `@hono/node-server`, as Vite answers on Node's request and response.

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
  authorize?: (c: Context) => boolean | Promise<boolean>
  // The Vite config in development, by default `defineAdminViteConfig()` of
  // `root` and `base`.
  vite?: InlineConfig
  // The app's HTTP server, which then also serves Vite's HMR websocket.
  // Without it, Vite opens a port of its own for it.
  server?: Server
}

export interface AuthenticationFeatures {
  hasPasskeys: boolean
  hasTotp: boolean
  hasPasswordChange: boolean
  hasPasswordReset: boolean
}

export interface AdminServer {
  app: Hono
  // Stops Vite in development. Call it before closing the app's server,
  // which waits for the HMR websockets to end.
  close: () => Promise<void>
}

export function serveAdmin(options: AdminOptions): AdminServer {
  const { mode = 'production', authorize } = options
  const base = normalizeBase(options.base)
  const app = new Hono()
  app.get(`${base}/dito.js`, c => sendConfig(c, base, options))
  if (authorize) {
    app.use(`${base}/*`, async (c, next) => {
      if (/\/views\b/.test(c.req.path) && !(await authorize(c))) {
        return c.text('Unauthorized', 401)
      }
      await next()
    })
  }
  if (mode === 'development') {
    if (!options.root) {
      throw new Error('serveAdmin() needs `root` in development mode.')
    }
    const vite = useVite(base, options)
    app.use(`${base}/*`, vite.handler)
    return { app, close: vite.close }
  }
  if (!options.dist) {
    throw new Error('serveAdmin() needs `dist` in production mode.')
  }
  app.get(`${base}/*`, serveFiles(base, path.resolve(options.dist)))
  return { app, close: async () => {} }
}

function sendConfig(c: Context, base: string, options: AdminOptions) {
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
  c.header('Cache-Control', 'no-cache')
  c.header('Content-Type', 'text/javascript; charset=utf-8')
  return c.body(`window.dito = ${JSON.stringify(dito, null, 2)}`)
}

// Files with Vite's content hash in their names never change, the others are
// checked again on each load. Paths without an extension are routes of the
// admin and get `index.html`. Missing files go on to the app's `notFound()`.
function serveFiles(base: string, dist: string): MiddlewareHandler {
  return async (c, next) => {
    const name = decodePath(c.req.path.slice(base.length) || '/')
    if (name === null) return next()
    const file = path.join(dist, name)
    if (!file.startsWith(`${dist}${path.sep}`)) return next()
    const stats = await getFileStats(file)
    if (stats) return sendFile(c, file, stats.size, hashedName.test(name))
    if (path.extname(name)) return next()
    const index = path.join(dist, 'index.html')
    const indexStats = await getFileStats(index)
    return indexStats ? sendFile(c, index, indexStats.size, false) : next()
  }
}

const hashedName = /-[\w-]{8}\.\w+$/

function decodePath(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

async function getFileStats(file: string) {
  const stats = await fs.promises.stat(file).catch(() => null)
  return stats?.isFile() ? stats : null
}

function sendFile(c: Context, file: string, size: number, isHashed: boolean) {
  c.header(
    'Content-Type',
    getMimeType(file) ?? 'application/octet-stream'
  )
  c.header('Content-Length', String(size))
  c.header(
    'Cache-Control',
    isHashed ? 'public, max-age=31536000, immutable' : 'no-cache'
  )
  if (c.req.method === 'HEAD') return c.body(null)
  const stream = Readable.toWeb(fs.createReadStream(file))
  return c.body(stream as ReadableStream)
}

function useVite(base: string, options: AdminOptions) {
  const server = createViteServer(base, options)
  // A failed start reaches the requests through `await server`.
  server.catch(() => {})
  let isClosed = false

  const handler: MiddlewareHandler<{ Bindings: HttpBindings }> = async (
    c,
    next
  ) => {
    // Vite's client copes best with 408 during shut-down: 503 keeps the
    // app's server from closing, and 205 stops later hot reloads.
    if (isClosed) return c.body(null, 408)
    const { incoming, outgoing } = c.env ?? {}
    if (!incoming || !outgoing) {
      throw new Error('serveAdmin() needs @hono/node-server in development.')
    }
    const vite = await server
    const isSent = await new Promise<boolean>((resolve, reject) => {
      const sent = () => {
        outgoing.off('finish', sent)
        outgoing.off('close', sent)
        resolve(true)
      }
      outgoing.on('finish', sent)
      outgoing.on('close', sent)
      vite.middlewares(incoming, outgoing, (error?: unknown) => {
        outgoing.off('finish', sent)
        outgoing.off('close', sent)
        if (error) reject(error)
        else resolve(false)
      })
    })
    if (!isSent) return next()
    const { RESPONSE_ALREADY_SENT } =
      await import('@hono/node-server/utils/response')
    return RESPONSE_ALREADY_SENT
  }

  const close = async () => {
    if (isClosed) return
    isClosed = true
    const vite = await server.catch(() => null)
    await vite?.close()
  }

  return { handler: handler as MiddlewareHandler, close }
}

async function createViteServer(
  base: string,
  options: AdminOptions
): Promise<ViteDevServer> {
  const { createServer } = await import('vite')
  const config = (
    options.vite ??
    (await defineAdminViteConfig({
      root: options.root!,
      base,
      mode: 'development'
    }))
  )
  return createServer(
    assignDeeply(
      {
        server: {
          middlewareMode: true,
          ...(options.server && { ws: { server: options.server } }),
          // Watches the Dito.js packages, although they're in `node_modules`.
          watch: { ignored: ['!**/node_modules/@ditojs/**'] }
        }
      },
      config
    ) as InlineConfig
  )
}
