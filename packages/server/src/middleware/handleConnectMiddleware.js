import { PassThrough } from 'stream'
import { isString, isArray, isObject } from '@ditojs/utils'

export function handleConnectMiddleware(middleware, {
  expandMountPath = false
}) {
  return (ctx, next) => {
    return new Promise(resolve => {
      let body = null

      const res = {
        locals: ctx.state,

        get statusCode() {
          return ctx.status
        },

        set statusCode(status) {
          ctx.status = status
        },

        getHeader(field) {
          // console.log('getHeader', ...arguments)
          return ctx.get(field)
        },

        setHeader(field, value) {
          // console.log('setHeader', ...arguments)
          ctx.set(field, value)
        },

        writeHead(status, message, headers) {
          // console.log('writeHead', ...arguments)
          ctx.status = status
          if (isString(message)) {
            ctx.body = message
          } else {
            headers = message
          }
          if (isArray(headers)) {
            // Convert raw headers array to object.
            headers = Object.fromEntries(headers.reduce(
              // Translate raw array to [field, value] tuplets.
              (entries, value, index) => {
                if (index & 1) { // Odd: value
                  entries[entries.length - 1].push(value)
                } else { // Even: field
                  entries.push([value])
                }
                return entries
              }, []))
          }
          if (isObject(headers)) {
            ctx.set(headers)
          }
        },

        write(...args) {
          // console.log('write', ...arguments)
          if (!body) {
            body = new PassThrough()
            ctx.body = body
          }
          body.write(...args)
        },

        end(body) {
          // console.log('end', body?.substring?.(0, 256))
          if (body !== undefined) {
            ctx.body = body
          }
          resolve()
        }
      }

      if (expandMountPath && ctx.mountPath) {
        // Create an inheriting `ctx` object with the expanded `ctx.path`,
        // without actually modifying the original `ctx` object.
        ctx = Object.create(ctx, {
          path: {
            value: ctx.mountPath + ctx.path
          }
        })
      }
      middleware(ctx.req, res, next)
    })
  }
}
