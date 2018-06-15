import ControllerAction from './ControllerAction'

export default class MemberAction extends ControllerAction {
  constructor(controller, handler, verb, path, authorize) {
    super(controller, handler, verb, path, authorize)
    // Copy over fields set by @scope() and @eagerScope() decorators
    this.scope = handler.scope
    this.eagerScope = handler.eagerScope
  }

  // @override
  async collectArguments(ctx) {
    const consumed = {}
    const args = this.collectConsumedArguments(ctx, consumed)
    let memberCtx = ctx
    if (this.hasQueryParams()) {
      // Create a copy of ctx that inherits from the real one but overrides
      // query with a version that has all consumed query params removed so it
      // can be passed on to `getMember()` which calls `actions.find(ctx)`:
      const query = {}
      for (const key in ctx.query) {
        if (!consumed[key]) {
          query[key] = ctx.query[key]
        }
      }
      memberCtx = Object.setPrototypeOf({ query }, ctx)
    }
    // Resolve member and add as second argument to list, right after `ctx`:
    args.splice(1, 0, await this.getMember(memberCtx))
    return args
  }

  getMember(ctx) {
    return this.controller.member.find.call(
      this.controller,
      ctx,
      // Provide a `modify()` function for `find()` to handle the setting of
      // `this.scope` and `this.eagerScope` on the query, see constructor()
      query => this.controller.setupQuery(query, this)
    )
  }
}
