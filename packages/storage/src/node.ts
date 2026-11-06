import type { MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'
import { serveStatic } from '@hono/node-server/serve-static'
import { DiskStorage } from './DiskStorage.ts'
import type { Storage } from './Storage.ts'

// Route the middleware at the path of the storage's `url`:
// `app.use('/files/*', serveStorage(storage))`
export function serveStorage(storage: Storage): MiddlewareHandler {
  if (!(storage instanceof DiskStorage)) {
    throw new Error(`Unable to serve '${storage.name}': not a disk storage.`)
  }
  const root = storage.path
  return (c, next) => {
    // Cut the route's path, so `/files/3/f/3f2b….png` reads `3/f/3f2b….png`:
    const base = routePath(c).replace(/\/?\*$/, '')
    return serveStatic({
      root,
      rewriteRequestPath: path => path.slice(base.length)
    })(c, next)
  }
}
