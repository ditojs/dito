import { action } from '@/decorators'
import { ModelController } from './ModelController'

// TODO: Rename to UsersController?
export class UserController extends ModelController {
  collection = {
    @action('post')
    async login(ctx) {
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

    @action('post')
    async logout(ctx) {
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

    @action('get')
    session(ctx) {
      const authenticated = this.isAuthenticated(ctx)
      return {
        authenticated,
        user: authenticated ? ctx.state.user : null
      }
    },

    @action('get')
    self(ctx) {
      return this.isAuthenticated(ctx)
        ? this.member.find.call(
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
