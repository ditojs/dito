export default function routerHandler(router) {
  return async (ctx, next) => {
    const { method, path } = ctx
    const result = router.find(method, path)
    const { handler: route, params } = result
    if (route) {
      const { handler, ...rest } = route
      ctx.route = rest
      ctx.params = params || {}
      await handler(ctx, next)
    } else {
      // No route was found. See if the remaining middleware does something with
      // this request. If not, return the errors as received from the router:
      try {
        await next()
      } finally {
        if (ctx.body === undefined && ctx.status === 404) {
          ctx.status = result.status || 404
          // Only retrieve `allowed` now, because it involves calling a
          // potentially computationally "heavy" getter:
          if (ctx.status !== 404 && result.allowed) {
            ctx.set('Allow', result.allowed.join(', '))
          }
        }
      }
    }
  }
}
