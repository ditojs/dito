import ControllerAction from './ControllerAction'

export default class MemberAction extends ControllerAction {
  // @override
  async collectArguments(ctx, parameters) {
    const consumed = parameters && {}
    const args = this.collectConsumedArguments(ctx, parameters, consumed)
    let memberCtx = ctx
    if (consumed) {
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
    return this.controller.member.find.call(this.controller, ctx)
  }
}
