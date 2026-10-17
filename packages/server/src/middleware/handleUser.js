import { createHash } from 'node:crypto'

export function handleUser() {
  return async (ctx, next) => {
    // The session key `passport` stems from koa-passport. We keep it so that
    // existing sessions remain valid.
    const { user: identifier, passwordFingerprint } = (
      ctx.session?.passport ?? {}
    )
    if (identifier) {
      const { modelName, id } = parseUserIdentifier(identifier)
      const userClass = ctx.app.models[modelName]
      const user = userClass?.sessionQuery
        ? await userClass.sessionQuery(ctx.transaction).findById(id)
        : null
      if (
        user && (
          // Sessions from before fingerprints were stored stay valid:
          passwordFingerprint === undefined ||
          passwordFingerprint === getPasswordFingerprint(user)
        )
      ) {
        ctx.state.user = user
      } else {
        // End the session of users that no longer exist, are excluded by the
        // session scope, or changed their password since.
        delete ctx.session.passport
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
          session.passport = {
            user: getUserIdentifier(user),
            passwordFingerprint: getPasswordFingerprint(user)
          }
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

// To support multiple user model classes, sessions identify users by both their
// model class name and id:
export function getUserIdentifier(user) {
  return `${user.constructor.name}-${user.$id()}`
}

export function parseUserIdentifier(identifier) {
  // Only split at the first hyphen, since ids may contain hyphens (UUIDs):
  const [, modelName, id] = identifier.match(/^([^-]+)-(.+)$/) ?? []
  return { modelName, id }
}

// Keep the session of a user that changed their password, while their other
// sessions end:
export function updatePasswordFingerprint(ctx, user) {
  const { passport } = ctx.session ?? {}
  if (passport?.user === getUserIdentifier(user)) {
    passport.passwordFingerprint = getPasswordFingerprint(user)
  }
}

// Sessions can be stored in cookies, so they store a hash of the password hash,
// not the hash itself:
function getPasswordFingerprint(user) {
  return user.hash
    ? createHash('sha256').update(user.hash).digest('base64url')
    : null
}
