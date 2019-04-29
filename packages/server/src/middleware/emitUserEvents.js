export function emitUserEvents() {
  return async (ctx, next) => {
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
      await user?.$emit('after:logout', options)
    }

    return next()
  }
}
