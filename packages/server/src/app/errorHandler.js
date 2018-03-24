import { ResponseError } from '@/errors'

export default function errorHandler() {
  return async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      ctx.status = err.status || 500
      if (ctx.accepts('json') && !ctx.request.URL.pathname.endsWith('.js')) {
        ctx.body = err instanceof ResponseError
          ? err.toJSON()
          : {
            message: err.message || 'An error has occurred.'
          }
      }
      ctx.app.emit('error', err, ctx)
    }
  }
}
