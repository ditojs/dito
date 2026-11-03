import type { MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'
import { serveStatic } from '@hono/node-server/serve-static'
import type { DiskStorage } from './DiskStorage.ts'

// Serves the files of a disk storage with `serveStatic()` of
// `@hono/node-server`. The host routes it at the path of the storage's `url`:
// `app.use('/files/*', serveStorage(storage))`. The path that the route matches
// is cut from the request's path, so `/files/3/f/3f2b….png` reads
// `3/f/3f2b….png` in the storage's folder.
export function serveStorage(storage: DiskStorage): MiddlewareHandler {
  const root = storage.path
  return (c, next) => {
    const base = routePath(c).replace(/\/?\*$/, '')
    return serveStatic({
      root,
      rewriteRequestPath: path => path.slice(base.length)
    })(c, next)
  }
}
