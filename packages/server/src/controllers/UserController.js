import { action } from '@/decorators'
import { ModelController } from './ModelController'

export class UserController extends ModelController {
  collection = {
    @action('get') // TODO: switch to post once the form is in place.
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

    @action('get') // TODO: switch to post once the form is in place.
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
    session(ctx) {
      return {
        authenticated: ctx.isAuthenticated(),
        user: ctx.state.user
      }
    }
  }
}
