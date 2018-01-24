import { Controller } from './Controller'
import { verb } from '@/decorators'

export class UserController extends Controller {
  collection = {
    @verb('get') // TODO: post?
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

    @verb('get') // TODO: post?
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

    @verb('get')
    current(ctx) {
      return {
        authenticated: ctx.isAuthenticated(),
        user: ctx.state.user
      }
    }
  }
}
