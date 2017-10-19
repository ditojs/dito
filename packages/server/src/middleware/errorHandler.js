export default function errorHandler() {
  return async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      // TODO: logging?
      console.error(err)
      ctx.status = err.statusCode || err.status || 500
      ctx.body = err.message || 'An error has occurred.'
      // TODO: Needed?
      ctx.app.emit('error', err, ctx)
    }
  }
}
