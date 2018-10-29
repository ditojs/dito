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
        // Or, if we activate `change-tracking`: (but is it better?)
        // user.lastLogin = new Date()
        // await user.$store()
      } catch (err) {
        this.app.emit('error', err, ctx)
        user = null
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

    @action('post')
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
    },

    @action('get')
    self(ctx) {
      const { user } = ctx.state
      if (ctx.isAuthenticated() && user instanceof this.modelClass) {
        ctx.params.id = user.id
        return this.member.find.call(this, ctx)
      }
    }
  }

  member = {
    authorize: ['$self']
  }
}
