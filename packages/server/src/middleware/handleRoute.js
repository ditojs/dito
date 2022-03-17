export function handleRoute() {
  return async (ctx, next) => {
    const { middleware } = ctx.route
    if (middleware) {
      await middleware(ctx, next)
    } else {
      // No route was found. See if the remaining middleware does something with
      // this request. If not, return the errors as received from the router:
      try {
        await next()
      } finally {
        if (ctx.body === undefined && ctx.status === 404) {
          ctx.status = ctx.route.status || 404
          // Only retrieve `allowed` now, because it involves calling a getter
          // and some internal processing:
          if (ctx.status !== 404 && ctx.route.allowed) {
            ctx.set('Allow', ctx.route.allowed.join(', '))
          }
        }
      }
    }
  }
}
