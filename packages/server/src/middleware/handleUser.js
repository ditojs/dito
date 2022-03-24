export function handleUser() {
  return (ctx, next) => {
    // Attach a logger instance with the user to the context.
    ctx.logger = ctx.logger?.child({ user: ctx.state.user }) || null

    // Override `ctx.login()` and `ctx.logout()` with versions that emit events
    // on the user model:
    const { login, logout } = ctx

    ctx.login = async function(user, options = {}) {
      await user.$emit('before:login', options)
      await login.call(this, user, options)
      await user.$emit('after:login', options)
    }

    ctx.logout = async function(options = {}) {
      const { user } = ctx.state
      await user?.$emit('before:logout', options)
      await logout.call(this) // No options in passport's logout()
      // Clear the session after logout, apparently koa-passport doesn't take
      // care of this itself:
      // https://stackoverflow.com/questions/55818887/koa-passport-logout-is-not-clearing-session
      ctx.session = null
      await user?.$emit('after:logout', options)
    }

    return next()
    // Don't set back `ctx.logger` because the context is still valid. It is
    // used in `logResponse()` of the `logRequests()` middleware, among others.
  }
}
