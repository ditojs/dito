export function findRoute(router) {
  return (ctx, next) => {
    const result = router.find(ctx.method, ctx.path)
    // We use `result.handler` to store the route object for matched routes.
    // If none is found, set `ctx.route = result`, for  `{ status, allowed }`.
    ctx.route = result.handler ? { ...result.handler } : result
    ctx.params = result.params || {}
    return next()
  }
}
