export function ensureRunning(app) {
  return async (ctx, next) => {
    if (app.isRunning) {
      await next()
    } else {
      // When the app isn't running, e.g. while stopping, we don't want to send
      // content back anymore even if the controllers would still respond. This
      // is to avoid strange behavior during shut-down of the vite dev server.
      // For that scenario, sending back an empty 205 response seems to work.
      ctx.status = 205 // HTTP_RESET_CONTENT
    }
  }
}
