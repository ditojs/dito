import ControllerAction from './ControllerAction.js'

export default class MemberAction extends ControllerAction {
  // @override
  async callAction(ctx) {
    // Include `ctx.memberId` for convenient access in member actions.
    return super.callAction(this.controller.getContextWithMemberId(ctx))
  }

  // @override
  async getMember(ctx, param) {
    // member parameters can provide special query parameters as well,
    // and they can even controll `forUpdate()` behavior:
    // {
    //   member: true,
    //   query: { ... },
    //   forUpdate: true,
    //   modify: query => query.degbug()
    // }
    // These are passed on to and handled in `CollectionController#getMember()`.
    // For handling of `member: true` and calling of `MemberAction.getMember()`,
    // see `ControllerAction#collectArguments()`.
    // Pass on `this.handler` as `base` for `setupQuery()`,
    // to handle the setting of `handler.scope` & co. on the query.
    return this.controller.getMember(ctx, this.handler, param)
  }
}
