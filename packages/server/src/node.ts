import { once } from 'node:events'
import { createAdaptorServer } from '@hono/node-server'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context, Hono, MiddlewareHandler } from 'hono'
import { parseDuration } from '@ditojs/utils'

// Runs a Hono app on Node: `serve()` with a graceful close, and `forwarded()`
// and `getClientAddress()` for apps behind reverse proxies.

export interface ServeOptions {
  port?: number | string
  host?: string
  // The time that `close()` may take before it fails, in milliseconds or as a
  // duration such as `'10s'`. 0 waits without a limit.
  closeTimeout?: number | string
  // Runs after the server has stopped, to stop the app.
  onClose?: () => void | Promise<void>
}

// Serves `app` on Node until `close()` or SIGINT and SIGTERM, which exit the
// process once the server has stopped.
export async function serve(
  app: Hono<any, any, any>,
  { port, host, closeTimeout = 0, onClose }: ServeOptions = {}
) {
  const timeout = parseDuration(closeTimeout)
  const server = createAdaptorServer({ fetch: app.fetch })
  server.listen(Number(port ?? 0), host)
  await once(server, 'listening')

  let closing: Promise<void> | undefined
  const stop = async () => {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    )
    await onClose?.()
  }
  const close = () => (closing ??= withTimeout(stop(), timeout))
  // A failed close is an unhandled rejection, which Node prints before it
  // exits. A second signal ends the process, as the listeners are removed.
  const onSignal = () => close().then(() => process.exit(0))
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  return { server, close }
}

function withTimeout(promise: Promise<void>, timeout: number) {
  if (timeout <= 0) return promise
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((resolve, reject) => {
    timer = setTimeout(
      reject,
      timeout,
      new Error(`Timeout reached while stopping the server (${timeout}ms)`)
    )
  })
  return Promise.race([promise, timedOut]).finally(() => clearTimeout(timer))
}

// Middleware for apps behind reverse proxies. `proxy` is the number of
// trusted proxies, and `true` means one. The request gets its public URL from
// the first values of `X-Forwarded-Proto` and `X-Forwarded-Host`, and the
// client's address is the entry of `X-Forwarded-For` that `proxy` hops from
// the right, as each proxy adds the address it received the request from.
// Requests without the headers keep their URL and address.
export function forwarded(proxy: boolean | number = true): MiddlewareHandler {
  const hops = proxy === true ? 1 : proxy || 0
  return async (c, next) => {
    if (hops) {
      const request = c.req.raw
      const url = getPublicUrl(request)
      if (url !== request.url) c.req.raw = copyRequest(request, url)
      const list = getList(request, 'X-Forwarded-For')
      const address = list[Math.max(list.length - hops, 0)]
      if (address) c.set('clientAddress', address)
    }
    await next()
  }
}

// The client's address: the one that `forwarded()` read, else the socket's.
export function getClientAddress(c: Context): string | undefined {
  return (
    c.var.clientAddress ??
    (c.env?.incoming ? getConnInfo(c).remote.address : undefined)
  )
}

function getList(request: Request, name: string) {
  return (request.headers.get(name) ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
}

function getPublicUrl(request: Request) {
  const [proto] = getList(request, 'X-Forwarded-Proto')
  const [host] = getList(request, 'X-Forwarded-Host')
  const url = new URL(request.url)
  // Take only `http` and `https`, and a plain host with an optional port:
  if (proto && /^https?$/i.test(proto)) url.protocol = proto
  if (host && /^([\w.-]+|\[[\da-f:.]+\])(:\d+)?$/i.test(host)) {
    // Setting `host` without a port keeps the current one.
    url.port = ''
    url.host = host
  }
  return url.href
}

// Undici doesn't accept a request of `@hono/node-server` as `RequestInit`, so
// the copy takes its fields. Its `body` and `redirect` start to read the
// socket, after which Node can't skip a body that the app leaves unread, and
// resets the keep-alive connection. So the copy reads the body only once the
// app reads it.
function copyRequest(request: Request, url: string) {
  const { method, headers, signal } = request
  const hasBody = method !== 'GET' && method !== 'HEAD'
  return new Request(url, {
    method,
    headers,
    signal,
    ...(hasBody && {
      body: ReadableStream.from(
        (async function* () {
          yield* request.body!
        })()
      ),
      duplex: 'half'
    })
  } as RequestInit)
}
