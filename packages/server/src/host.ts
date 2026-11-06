import type { MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { etag } from 'hono/etag'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { parseFileSize } from '@ditojs/utils'

// `false`, `true` for the defaults of the middleware, or its options:
type Option<T extends (...args: any[]) => unknown> =
  | boolean
  | NonNullable<Parameters<T>[0]>

export interface HostMiddlewareOptions {
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

// Hono's standard middleware for hosts, for `app.use(...hostMiddleware())`.
export function hostMiddleware({
  csrf: csrfOptions = true,
  secureHeaders: secureHeadersOptions = true,
  cors: corsOptions = false,
  etag: etagOptions = false,
  bodyLimit: bodyLimitOptions = true
}: HostMiddlewareOptions = {}) {
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
