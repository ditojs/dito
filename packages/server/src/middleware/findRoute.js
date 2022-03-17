export function findRoute(router) {
  return (ctx, next) => {
    const result = router.find(ctx.method, ctx.path)
    // We use `result.handler` as returned from the router to store the route
    // object for matched routes. If none is found, set `ctx.route = result`,
    // for `{ status, allowed }`.
    const route = result.handler ? { ...result.handler } : result
    ctx.route = route
    // NOTE: The name for `ctx.params` was inherited from `koa-router`
    ctx.params = result.params || {}
    const { controller, action } = route
    if (controller) {
      ctx.controller = controller
    }
    if (action) {
      ctx.action = action
    }
    return next()
  }
}
