import ControllerAction from './ControllerAction'

export default class MemberAction extends ControllerAction {
  // @override
  async collectArguments(ctx, parameters) {
    const consumed = parameters && {}
    const args = this.collectConsumedArguments(ctx, parameters, consumed)
    if (consumed) {
      // Create a copy of ctx that inherits from the real one but overrides
      // query with a version that has all consumed query params removed so it
      // can be passed on to getFirstArgument() which calls actions.find(ctx):
      ctx = Object.setPrototypeOf({}, ctx)
      ctx.query = Object.entries(ctx.query).reduce((query, [key, value]) => {
        if (!consumed[key]) {
          query[key] = value
        }
      }, {})
    }
    // Resolve member and add as first argument to list.
    args.unshift(await this.getMember(ctx))
    return args
  }

  getMember(ctx) {
    return this.controller.member.find.call(this.controller, ctx)
  }
}
