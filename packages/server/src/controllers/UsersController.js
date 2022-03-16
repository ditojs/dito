import { ModelController } from './ModelController.js'

export class UsersController extends ModelController {
  collection = {
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

  isAuthenticated(ctx) {
    // Make sure the currently logged in user has the correct model-class:
    return ctx.isAuthenticated() && ctx.state.user instanceof this.modelClass
  }
}
