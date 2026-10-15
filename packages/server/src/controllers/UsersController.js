import { ModelController } from './ModelController.js'
import { AuthorizationError } from '../errors/index.js'

export class UsersController extends ModelController {
  collection = {
    // These actions authenticate users, so the controller's `authorize`
    // setting doesn't apply to them:
    'authorize': {
      'post login': true,
      'post logout': true,
      'get session': true
    },

    async 'post login'(ctx) {
      let user
      let error
      try {
        user = await this.modelClass.login(ctx)
        await user.$patch({ lastLogin: new Date() }, ctx.transaction)
      } catch (err) {
        this.app.emit('error', err, ctx)
        user = null
        error = err.data?.message || err.message
        ctx.status = err.status || 401
      }
      const success = !!user
      return {
        success,
        authenticated: success && this.isAuthenticated(ctx),
        user,
        error
      }
    },

    async 'post logout'(ctx) {
      let success = false
      if (this.isAuthenticated(ctx)) {
        await ctx.logout()
        success = ctx.isUnauthenticated()
      }
      return {
        success,
        authenticated: this.isAuthenticated(ctx)
      }
    },

    'get session'(ctx) {
      const authenticated = this.isAuthenticated(ctx)
      return {
        authenticated,
        user: authenticated ? ctx.state.user : null
      }
    },

    'get self'(ctx) {
      return this.isAuthenticated(ctx)
        ? this.member.get.call(
            this,
            this.getContextWithMemberId(ctx, ctx.state.user.$id())
          )
        : null
    }
  }

  member = {
    authorize: ['$self']
  }

  // @override
  getMemberId(ctx) {
    // `self` stands for the logged-in user in member routes, e.g. in
    // `PATCH /users/self`:
    if (ctx.params[this.idParam] !== 'self') {
      return super.getMemberId(ctx)
    } else if (this.isAuthenticated(ctx)) {
      return ctx.state.user.$id()
    } else {
      throw new AuthorizationError()
    }
  }

  isAuthenticated(ctx) {
    // Make sure the currently logged in user has the correct model-class:
    return ctx.isAuthenticated() && ctx.state.user instanceof this.modelClass
  }
}
