import { ResponseError } from '@/errors'

export default function errorHandler() {
  return async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      ctx.status = err.status || 500
      ctx.body = err instanceof ResponseError
        ? err.data
        : {
          message: err.message || 'An error has occurred.'
        }
      ctx.app.emit('error', err, ctx)
    }
  }
}
