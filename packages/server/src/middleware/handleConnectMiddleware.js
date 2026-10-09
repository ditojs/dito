import { PassThrough } from 'stream'
import { isString, isArray, isObject } from '@ditojs/utils'

export function handleConnectMiddleware(middleware, {
  expandMountPath = false
}) {
  return (ctx, next) => {
    return new Promise((resolve, reject) => {
      const { req } = ctx
      const mountedUrl = req.url
      if (expandMountPath && ctx.mountPath) {
        // Hand the full url including the mount path to the connect
        // middleware, and restore the mounted url before returning to Koa.
        req.url = ctx.mountPath + mountedUrl
      }

      function restoreUrl() {
        req.url = mountedUrl
      }

      let bodyStream = null

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
          return ctx.response.get(field)
        },

        setHeader(field, value) {
          // console.log('setHeader', ...arguments)
          ctx.set(field, value)
        },

        appendHeader(field, value) {
          // console.log('appendHeader', ...arguments)
          ctx.append(field, value)
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
            headers = Object.fromEntries(
              headers.reduce(
                // Translate raw array to [field, value] tuples.
                (entries, value, index) => {
                  if (index & 1) {
                    // Odd: value
                    entries[entries.length - 1].push(value)
                  } else {
                    // Even: field
                    entries.push([value])
                  }
                  return entries
                },
                []
              )
            )
          }
          if (isObject(headers)) {
            ctx.set(headers)
          }
        },

        write(...args) {
          // console.log('write', ...arguments)
          if (!bodyStream) {
            bodyStream = new PassThrough()
            ctx.body = bodyStream
          }
          bodyStream.write(...args)
        },

        end(chunk) {
          // console.log('end', chunk?.substring?.(0, 256))
          if (bodyStream) {
            // Write the optional final chunk and end the stream started by
            // `write()`.
            bodyStream.end(chunk)
          } else if (chunk !== undefined) {
            ctx.body = chunk
          }
          restoreUrl()
          resolve()
        }
      }

      try {
        // Requests that the connect middleware passes on through its `next()`
        // continue with the next Koa middleware.
        middleware(req, res, error => {
          restoreUrl()
          if (error) {
            reject(error)
          } else {
            resolve(next())
          }
        })
      } catch (error) {
        restoreUrl()
        reject(error)
      }
    })
  }
}
