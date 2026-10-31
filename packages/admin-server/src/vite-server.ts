import net from 'node:net'
import type { AddressInfo } from 'node:net'
import type { InlineConfig, ViteDevServer } from 'vite'
import { assignDeeply, isString } from '@ditojs/utils'

// Runs Vite's dev server on a port of its own and passes requests to it with
// `fetch()`. The browser opens the HMR websocket on Vite's port directly, as
// a `fetch(request)` can't take over a connection. The port is `server.port`
// of the Vite config, or a free one.

export function startVite(config: Promise<InlineConfig>) {
  const server = createViteServer(config)
  // A failed start reaches the requests through `await server`.
  server.catch(() => {})
  let isClosed = false

  const fetchVite = async (
    request: Request,
    pathname: string
  ): Promise<Response> => {
    if (isClosed) return new Response(null, { status: 503 })
    const { origin } = await server
    const { search } = new URL(request.url)
    const response = await fetch(`${origin}${pathname}${search}`, {
      method: request.method,
      headers: getRequestHeaders(request.headers),
      body: request.body,
      // Node's `fetch()` needs this to send a body stream.
      duplex: 'half',
      redirect: 'manual',
      signal: request.signal
    } as RequestInit)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: getResponseHeaders(response.headers)
    })
  }

  const close = async () => {
    if (isClosed) return
    isClosed = true
    const result = await server.catch(() => null)
    await result?.vite.close()
  }

  return { fetch: fetchVite, close }
}

async function createViteServer(
  config: Promise<InlineConfig>
): Promise<{ vite: ViteDevServer; origin: string }> {
  const { createServer } = await import('vite')
  const viteConfig = await config
  const host = viteConfig.server?.host ?? '127.0.0.1'
  const port = viteConfig.server?.port ?? (await getFreePort(host))
  const vite = await createServer(
    assignDeeply(
      {
        server: {
          // Watches the Dito.js packages, although they're in `node_modules`.
          watch: { ignored: ['!**/node_modules/@ditojs/**'] }
        }
      },
      viteConfig,
      {
        server: {
          host,
          port,
          strictPort: true,
          // The page comes from the app's port, so the client needs Vite's.
          // The client uses `ws` unless Vite runs on HTTPS, also on pages
          // served over HTTPS.
          ws: {
            port,
            protocol: viteConfig.server?.https ? 'wss' : 'ws'
          }
        }
      }
    ) as InlineConfig
  )
  await vite.listen()
  const address = vite.httpServer!.address() as AddressInfo
  const protocol = viteConfig.server?.https ? 'https' : 'http'
  return {
    vite,
    origin: `${protocol}://${getConnectHost(address)}:${address.port}`
  }
}

function getFreePort(host: string | boolean) {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.on('error', reject)
    server.listen(0, isString(host) ? host : undefined, () => {
      const { port } = server.address() as AddressInfo
      server.close(() => resolve(port))
    })
  })
}

// The address to connect to, which is the loopback for servers on all
// interfaces.
function getConnectHost({ address, family }: AddressInfo) {
  if (address === '::' || address === '0.0.0.0') return '127.0.0.1'
  return family === 'IPv6' ? `[${address}]` : address
}

// `fetch()` sets `Host` to Vite's address, which Vite allows. Vite sends no
// compressed responses, and `identity` keeps `fetch()` from asking for them.
function getRequestHeaders(headers: Headers) {
  const result = new Headers(headers)
  for (const name of ['host', 'connection', 'keep-alive', 'upgrade']) {
    result.delete(name)
  }
  result.set('accept-encoding', 'identity')
  return result
}

// `fetch()` decodes compressed bodies, so their encoding and length no longer
// apply.
function getResponseHeaders(headers: Headers) {
  const result = new Headers(headers)
  for (const name of ['connection', 'keep-alive', 'transfer-encoding']) {
    result.delete(name)
  }
  if (result.has('content-encoding')) {
    result.delete('content-encoding')
    result.delete('content-length')
  }
  return result
}
