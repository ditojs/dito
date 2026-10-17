export function handleUser() {
  return async (ctx, next) => {
    // The session key `passport` stems from koa-passport. We keep it so that
    // existing sessions remain valid.
    const identifier = ctx.session?.passport?.user
    if (identifier) {
      // Only split at the first hyphen, since ids may contain hyphens (UUIDs).
      const [, modelName, id] = identifier.match(/^([^-]+)-(.+)$/) ?? []
      const userClass = ctx.app.models[modelName]
      const user = userClass?.sessionQuery
        ? await userClass.sessionQuery(ctx.transaction).findById(id)
        : null
      if (user) {
        ctx.state.user = user
      } else {
        // End the session of users that no longer exist or are excluded by the
        // session scope.
        delete ctx.session.passport.user
      }
    }

    // Attach a logger instance with the user to the context.
    ctx.logger = ctx.logger?.child({ user: ctx.state.user }) || null

    ctx.login = ctx.logIn = async (user, options = {}) => {
      const { session } = ctx
      const { name, sessionQuery } = user.constructor
      const shouldUseSession = options.session !== false
      // Check before emitting events, for logins that fail anyway:
      if (shouldUseSession && !session) {
        throw new Error(`Unable to log in without sessions, see 'app.session'.`)
      } else if (shouldUseSession && !sessionQuery) {
        throw new Error(`Unable to log in '${name}', which isn't a user.`)
      } else {
        await user.$emit('before:login', options)
        if (shouldUseSession) {
          // To support multiple user model classes, use both the model class
          // name and id as identifier.
          session.passport = { user: `${name}-${user.$id()}` }
          // Regenerate the session id against session fixation, which also
          // saves the session.
          await session.regenerate()
        }
        ctx.state.user = user
        await user.$emit('after:login', options)
      }
    }

    ctx.logout = ctx.logOut = async (options = {}) => {
      const { user } = ctx.state
      await user?.$emit('before:logout', options)
      ctx.state.user = null
      // Clear the whole session after logout, not just the user:
      ctx.session = null
      await user?.$emit('after:logout', options)
    }

    ctx.isAuthenticated = () => !!ctx.state.user
    ctx.isUnauthenticated = () => !ctx.state.user

    return next()
    // Don't set back `ctx.logger` because the context is still valid. It is
    // used in `logResponse()` of the `logRequests()` middleware, among others.
  }
}
