import ControllerAction from './ControllerAction'

export default class MemberAction extends ControllerAction {
  // @override
  async getMember(ctx, query = {}) {
    return this.controller.member.find.call(
      this.controller,
      // Create a copy of `ctx` that inherits from the real one but overrides
      // query with the one defined in the parameter entry. This inherits the
      // route params in `ctx.params`, so fining the member by id still works.
      Object.setPrototypeOf({ query }, ctx),
      // Provide a `modify()` function for `find()`, to handle the setting of
      // `handler.scope` on the query, see the `base` argument in `setupQuery()`
      query => this.controller.setupQuery(query, this.handler)
    )
  }
}
