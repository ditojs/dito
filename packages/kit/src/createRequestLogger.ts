import { every } from 'hono/combine'
import { requestId } from 'hono/request-id'
import type { Logger } from 'pino'
import type { Middleware } from '@ditojs/server'

declare module '@ditojs/server' {
  interface DitoVariables {
    // The logger of the request, with its id.
    logger: Logger
  }
}

// Sets `c.var.logger` to a child of `logger` with the id of the request, and
// logs the responses of API actions. Files, such as those of the admin, get no
// line: there are many of them, and a reverse proxy logs them.
export function createRequestLogger(logger: Logger): Middleware {
  return every(requestId(), async (c, next) => {
    const child = logger.child({ requestId: c.var.requestId })
    c.set('logger', child)
    const start = performance.now()
    await next()
    if (c.var.action) {
      const { method, url } = c.req
      const { pathname, search } = new URL(url)
      const time = Math.round(performance.now() - start)
      child.info(`${method} ${pathname}${search} ${c.res.status} ${time}ms`)
    }
  })
}
