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
        ? callSelfAction(this.controller, ctx, 'get')
        : null
    },

    'patch self'(ctx) {
      return callSelfAction(this.controller, ctx, 'patch')
    }
  }

  member = {
    authorize: ['$self']
  }

  // @override
  setupAction(type, actions, name, action, authorize) {
    const controllerAction = super.setupAction(
      type,
      actions,
      name,
      action,
      authorize
    )
    if (type === 'collection' && controllerAction.path === 'self') {
      // Transactions are created per route, so create one for `self` where its
      // member action needs one:
      controllerAction.transacted ||= !!getSelfAction(
        this,
        controllerAction.method
      )?.transacted
    }
    return controllerAction
  }

  isAuthenticated(ctx) {
    // Make sure the currently logged in user has the correct model-class:
    return ctx.isAuthenticated() && ctx.state.user instanceof this.modelClass
  }
}

// Run the member action for the logged-in user, with all its settings:
function callSelfAction(controller, ctx, method) {
  const action = getSelfAction(controller, method)
  if (action && controller.isAuthenticated(ctx)) {
    return action.callAction(ctx, ctx.state.user.$id())
  } else {
    throw new AuthorizationError()
  }
}

function getSelfAction(controller, method) {
  // Users can only access themselves where `allow` routes the member action:
  return Object.hasOwn(controller.member, method)
    ? controller.memberActions[method]
    : null
}
