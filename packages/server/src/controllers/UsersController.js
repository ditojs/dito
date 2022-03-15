import { ModelController } from './ModelController'

export class UsersController extends ModelController {
  collection = {
    login: {
      method: 'post',
      async handler(ctx) {
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
      }
    },

    logout: {
      method: 'post',
      async handler(ctx) {
        let success = false
        if (this.isAuthenticated(ctx)) {
          await ctx.logout()
          success = ctx.isUnauthenticated()
        }
        return {
          success,
          authenticated: this.isAuthenticated(ctx)
        }
      }
    },

    session: {
      method: 'get',
      handler(ctx) {
        const authenticated = this.isAuthenticated(ctx)
        return {
          authenticated,
          user: authenticated ? ctx.state.user : null
        }
      }
    },

    self: {
      method: 'get',
      handler(ctx) {
        return this.isAuthenticated(ctx)
          ? this.member.find.call(
            this,
            this.getContextWithMemberId(ctx, ctx.state.user.$id())
          )
          : null
      }
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
