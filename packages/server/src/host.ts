import type { MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { etag } from 'hono/etag'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'

// Hono's standard middleware for a host, for `app.use(...hostMiddleware())`.
// Each option is `false`, `true` for the defaults of that middleware, or its
// options.

type Option<T extends (...args: any[]) => unknown> =
  | boolean
  | NonNullable<Parameters<T>[0]>

export interface HostOptions {
  // On by default. It only checks requests with `Origin`: browsers send it,
  // and an attack needs a browser.
  csrf?: Option<typeof csrf>
  // On by default.
  secureHeaders?: Option<typeof secureHeaders>
  // Off by default.
  cors?: Option<typeof cors>
  // Off by default.
  etag?: Option<typeof etag>
  // 1 MB by default. Multipart bodies, such as uploads, have no limit.
  bodyLimit?: boolean | Partial<Parameters<typeof bodyLimit>[0]>
}

const defaultBodyLimit = 1024 * 1024

const overBodyLimit = () => {
  throw new HTTPException(413, { message: 'Payload Too Large' })
}

// `csrf()` and `bodyLimit()` run after `secureHeaders()` and `cors()`, so that
// their responses have the headers of these.
export function hostMiddleware({
  csrf: csrfOptions = true,
  secureHeaders: secureHeadersOptions = true,
  cors: corsOptions = false,
  etag: etagOptions = false,
  bodyLimit: bodyLimitOptions = true
}: HostOptions = {}) {
  const options = <T>(value: true | T) => (value === true ? undefined : value)
  const middleware: MiddlewareHandler[] = []
  if (secureHeadersOptions) {
    middleware.push(secureHeaders(options(secureHeadersOptions)))
  }
  if (corsOptions) middleware.push(cors(options(corsOptions)))
  if (etagOptions) middleware.push(etag(options(etagOptions)))
  if (csrfOptions) {
    const check = csrf(options(csrfOptions))
    middleware.push((c, next) =>
      c.req.header('Origin') ? check(c, next) : next()
    )
  }
  if (bodyLimitOptions) {
    const { maxSize, onError } = {
      maxSize: defaultBodyLimit,
      onError: overBodyLimit,
      ...options(bodyLimitOptions)
    }
    const limit = bodyLimit({ maxSize, onError })
    middleware.push(async (c, next) => {
      if (c.req.header('Content-Type')?.startsWith('multipart/')) return next()
      const size = c.req.header('Content-Length')
      if (size === undefined) return limit(c, next)
      // `bodyLimit()` reads `c.req.raw.body`, after which `@hono/node-server`
      // resets the connection of a body that nothing read. The next request
      // of a keep-alive connection would fail. So bodies of a known size don't
      // go through it.
      return Number(size) > maxSize ? onError(c) : next()
    })
  }
  return middleware
}
