import ControllerAction from './ControllerAction'
import { ControllerError } from '@/errors'

export default class MemberAction extends ControllerAction {
  // @override
  async callAction(ctx) {
    try {
      // Set `ctx.memberId` for convenient access in member actions,
      // and clear it again at the end.
      ctx.memberId = this.controller.getMemberId(ctx)
      // NOTE: Don't remove `await` here, or the `finally` would occur to soon.
      return await super.callAction(ctx)
    } finally {
      delete ctx.memberId
    }
  }

  // @override
  async getMember(ctx, param) {
    // member @parameters() can provide special query parameters as well,
    // and they can even controll forUpdate() behavior:
    // {
    //   member: true,
    //   query: { ... },
    //   forUpdate: true,
    //   modify: query => query.degbug()
    // }
    const {
      query = {},
      modify,
      forUpdate = false
    } = param || {}
    // member entries can provide special query parameters as well:
    // `{ member: true, query: { ... }, forUpdate: true }`
    // For handling of `member: true` and calling of `MemberAction.getMember()`,
    // see `ControllerAction.collectArguments()`.
    return this.controller.member.find.call(
      this.controller,
      // Create a copy of `ctx` that inherits from the real one but overrides
      // query with the one defined in the parameter entry. This inherits the
      // route params in `ctx.params`, so fining the member by id still works.
      // TODO: Why was it necessary again to do this?
      Object.setPrototypeOf({ query }, ctx),
      // Provide a `modify()` function for `find()`, to handle the setting of
      // `handler.scope` on the query, see the `base` argument in `setupQuery()`
      (query, trx) => {
        this.controller.setupQuery(query, this.handler)
        query.modify(modify)
        if (forUpdate) {
          if (!trx) {
            throw new ControllerError(
              this.controller,
              'Using `forUpdate()` without a transaction is invalid'
            )
          }
          query.forUpdate()
        }
      }
    )
  }
}
