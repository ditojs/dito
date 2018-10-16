export function emitUserEvents() {
  return async (ctx, next) => {
    // Override `ctx.login()` and `ctx.logout()` with versions that emit events
    // on the user model:

    const { login, logout } = ctx

    ctx.login = async function(user, options) {
      await user.$emit('before:login')
      await login.call(this, user, options)
      await user.$emit('after:login')
    }

    ctx.logout = async function() {
      const { user } = ctx.state
      await user?.$emit('before:logout')
      await logout.call(this)
      await user?.$emit('after:logout')
    }

    return next()
  }
}
