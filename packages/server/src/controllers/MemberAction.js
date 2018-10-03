import ControllerAction from './ControllerAction'

export default class MemberAction extends ControllerAction {
  // @override
  async collectArguments(ctx) {
    const consumed = {}
    const args = this.collectConsumedArguments(ctx, consumed)
    if (this.parameters.member) {
      // Resolve member and add it as first argument to list, but nly passed the
      // unconsumed arguments to `getMember()`, which calls `actions.find(ctx)`:
      args.unshift(
        await this.getMember(this.removeConsumedArguments(ctx, consumed))
      )
    }
    return args
  }

  removeConsumedArguments(ctx, consumed) {
    // If the action receives parameters from `ctx.query`, create a copy of
    // `ctx` that inherits from the real one but overrides query with a version
    // that has all consumed query params removed.
    if (
      this.parameters.rootName === 'query' &&
      Object.keys(consumed).length > 0
    ) {
      const query = {}
      for (const key in ctx.query) {
        if (!consumed[key]) {
          query[key] = ctx.query[key]
        }
      }
      ctx = Object.setPrototypeOf({ query }, ctx)
    }
    return ctx
  }

  getMember(ctx) {
    return this.controller.member.find.call(
      this.controller,
      ctx,
      // Provide a `modify()` function for `find()`, to handle the setting of
      // `handler.scope` and `handler.eagerScope` on the query, see the `base`
      // argument in `setupQuery()`
      query => this.controller.setupQuery(query, this.handler)
    )
  }
}
