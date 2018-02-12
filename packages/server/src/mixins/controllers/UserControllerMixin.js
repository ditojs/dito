import { action } from '@/decorators'

export const UserControllerMixin = Controller => class extends Controller {
  collection = {
    @action('get') // TODO: post?
    async login(ctx) {
      let user
      let error
      try {
        user = await this.modelClass.login(ctx)
        await user.$patch({ lastLogin: new Date() })
        // Or, if we activate `change-tracking`: (but is it better?)
        // user.lastLogin = new Date()
        // await user.$store()
      } catch (err) {
        error = err.data?.message || err.message
        ctx.status = err.status || 401
      }
      const success = !!user
      return {
        success,
        authenticated: success && ctx.isAuthenticated(),
        user,
        error
      }
    },

    @action('get') // TODO: post?
    async logout(ctx) {
      let success = false
      if (ctx.isAuthenticated()) {
        await ctx.logout()
        success = ctx.isUnauthenticated()
      }
      return {
        success,
        authenticated: ctx.isAuthenticated()
      }
    },

    @action('get')
    current(ctx) {
      return {
        authenticated: ctx.isAuthenticated(),
        user: ctx.state.user
      }
    }
  }
}
