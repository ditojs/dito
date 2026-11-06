import { Hono, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { etag } from 'hono/etag'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { parseFileSize } from '@ditojs/utils'
import { createErrorHandler, notFound } from './errors.ts'
import type { ErrorLogger } from './types.ts'

// `false`, `true` for the defaults of the middleware, or its options:
type Option<T extends (...args: any[]) => unknown> =
  | boolean
  | NonNullable<Parameters<T>[0]>

export interface HonoMiddlewareOptions {
  // On by default. It only checks requests with `Origin`: browsers send it,
  // and an attack needs a browser.
  csrf?: Option<typeof csrf>
  // On by default.
  secureHeaders?: Option<typeof secureHeaders>
  // Off by default.
  cors?: Option<typeof cors>
  // Off by default.
  etag?: Option<typeof etag>
  // 1 MB by default, with `maxSize` in bytes or as a string with a unit, such
  // as `'5mb'`. Multipart bodies, such as uploads, have no limit.
  bodyLimit?: boolean | BodyLimitOptions
}

type BodyLimitOptions = Partial<
  Omit<Parameters<typeof bodyLimit>[0], 'maxSize'> & {
    maxSize: number | string
  }
>

const defaultBodyLimit = 1024 * 1024

const rejectLargeBody = () => {
  throw new HTTPException(413, { message: 'Payload Too Large' })
}

// Hono's standard middleware, for `app.use(...honoMiddleware())`.
export function honoMiddleware({
  csrf: csrfOptions = true,
  secureHeaders: secureHeadersOptions = true,
  cors: corsOptions = false,
  etag: etagOptions = false,
  bodyLimit: bodyLimitOptions = true
}: HonoMiddlewareOptions = {}) {
  const getOptions = <T>(value: true | T) =>
    value === true ? undefined : value
  const middleware: MiddlewareHandler[] = []
  if (secureHeadersOptions) {
    middleware.push(secureHeaders(getOptions(secureHeadersOptions)))
  }
  if (corsOptions) middleware.push(cors(getOptions(corsOptions)))
  if (etagOptions) middleware.push(etag(getOptions(etagOptions)))
  // `csrf()` and `bodyLimit()` run last, so that their responses have the
  // headers of `secureHeaders()` and `cors()`.
  if (csrfOptions) {
    const check = csrf(getOptions(csrfOptions))
    middleware.push((c, next) =>
      c.req.header('Origin') ? check(c, next) : next()
    )
  }
  if (bodyLimitOptions) {
    const { maxSize: size = defaultBodyLimit, onError = rejectLargeBody } = (
      getOptions(bodyLimitOptions) ?? {}
    )
    const maxSize = parseFileSize(size)
    const limit = bodyLimit({ maxSize, onError })
    middleware.push(async (c, next) => {
      const length = c.req.header('Content-Length')
      // `bodyLimit()` reads `c.req.raw.body`, after which `@hono/node-server`
      // resets keep-alive connections of unread bodies, failing their next
      // request. So only bodies of an unknown size go through it.
      return c.req.header('Content-Type')?.startsWith('multipart/')
        ? next()
        : length === undefined
          ? limit(c, next)
          : Number(length) > maxSize
            ? onError(c)
            : next()
    })
  }
  return middleware
}

export interface CreateHonoOptions extends HonoMiddlewareOptions {
  // The number of trusted reverse proxies, as in `forwarded()`. None by
  // default.
  proxy?: boolean | number
  // As in `createApi()`, for the errors outside of APIs.
  onError?: ErrorLogger
  // Runs before all other middleware.
  middleware?: MiddlewareHandler[]
}

// The Hono app that routes the APIs with `hono.route()`. It has Dito's JSON
// errors, also for unknown paths, and runs `forwarded()` before
// `honoMiddleware()`, as `csrf()` compares the origin with the public URL.
export function createHono({
  proxy = false,
  onError,
  middleware = [],
  ...options
}: CreateHonoOptions = {}) {
  // Paths with a trailing slash match the routes without one.
  const hono = new Hono({ strict: false })
  hono.onError(createErrorHandler({ onError }))
  hono.notFound(notFound)
  hono.use(...middleware, forwarded(proxy), ...honoMiddleware(options))
  return hono
}

// Middleware for apps behind reverse proxies, with `proxy` as the number of
// trusted proxies, and `true` for one.
export function forwarded(proxy: boolean | number = true): MiddlewareHandler {
  const hops = proxy === true ? 1 : proxy || 0
  return async (c, next) => {
    if (hops) {
      const request = c.req.raw
      const url = getPublicUrl(request)
      // A copy would start to read the body, after which Node resets keep-alive
      // connections of bodies that the app leaves unread.
      if (url !== request.url)
        Object.defineProperty(request, 'url', { value: url })
      // Each proxy adds the address that it received the request from, so the
      // client's is the one `hops` from the right:
      const addresses = getHeaderValues(request, 'X-Forwarded-For')
      const address = addresses[Math.max(addresses.length - hops, 0)]
      if (address) c.set('clientAddress', address)
    }
    await next()
  }
}

function getHeaderValues(request: Request, name: string) {
  return (request.headers.get(name) ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
}

// Take the public URL from the first values of `X-Forwarded-Proto` and
// `X-Forwarded-Host`.
function getPublicUrl(request: Request) {
  const [proto] = getHeaderValues(request, 'X-Forwarded-Proto')
  const [host] = getHeaderValues(request, 'X-Forwarded-Host')
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
