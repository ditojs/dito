import { ResponseError } from '../errors/index.js'

export function handleError() {
  return async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      ctx.body = undefined
      ctx.status = err.status || 500
      // If the browser accepts json, return a JSON representation of the
      // error. But don't do so if the request actually went to js file.
      if (ctx.accepts('json') && !ctx.request.path.endsWith('.js')) {
        // Format error as JSON
        ctx.body = err instanceof ResponseError
          ? err.toJSON()
          : {
            message: err.message || 'An error has occurred.'
          }
      } else {
        // TODO: Consider handling html and xml responses also, see:
        // https://github.com/strongloop/strong-error-handler/blob/master/lib/send-html.js
        // https://github.com/strongloop/strong-error-handler/blob/master/lib/send-xml.js
        // https://github.com/strongloop/strong-error-handler/blob/master/views/default-error.ejs
      }
      ctx.app.emit('error', err, ctx)
    }
  }
}
