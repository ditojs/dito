import { createHash } from 'node:crypto'
import { AuthorizationError } from '../errors/index.js'

// The time to answer passkey challenges, and to confirm new TOTP secrets and
// complete the logins of users with TOTP:
export const authenticationTimeout = 5 * 60 * 1000 // 5 minutes

// To support multiple user model classes, sessions identify users by both their
// model class name and id:
export function getUserIdentifier(user) {
  return `${user.constructor.name}-${user.$id()}`
}

// Make sure the logged-in user has the exact model class, since sub-classes
// have their own tables and ids:
export function isAuthenticated(ctx, modelClass) {
  return ctx.isAuthenticated() && ctx.state.user.constructor === modelClass
}

// Security changes need a login or a 'post confirm-access' of the user within
// `app.authentication.reconfirmAccessAfter`:
export function hasConfirmedAccess(ctx, modelClass) {
  const { user, expires } = ctx.session.confirmedAccess ?? {}
  return (
    isAuthenticated(ctx, modelClass) &&
    user === getUserIdentifier(ctx.state.user) &&
    expires > Date.now()
  )
}

// Without a login of a user of `modelClass`, we answer 401. Without confirmed
// access, we answer 403 with `confirmationRequired`, for clients to confirm it:
export function checkConfirmedAccess(ctx, modelClass) {
  if (!isAuthenticated(ctx, modelClass)) {
    throw new AuthorizationError()
  } else if (!hasConfirmedAccess(ctx, modelClass)) {
    throw new AuthorizationError({
      message: 'Confirmation required',
      status: 403,
      confirmationRequired: true
    })
  }
}

export function parseUserIdentifier(identifier) {
  // Only split at the first hyphen, since ids may contain hyphens (UUIDs):
  const [, modelName, id] = identifier.match(/^([^-]+)-(.+)$/) ?? []
  return { modelName, id }
}

// Sessions can be stored in cookies, so they store a hash of the password hash,
// not the hash itself:
export function getPasswordFingerprint(hash) {
  return hash ? createHash('sha256').update(hash).digest('base64url') : null
}

// Credentials refer to their users by model name and id, as a string:
export function getCredentialQuery(user, type, trx) {
  return user.constructor
    .credentialQuery(trx)
    .where({ type, userId: `${user.$id()}` })
}

export function insertCredential(user, type, values, trx) {
  const { credentialClass, name } = user.constructor
  return credentialClass
    .query(trx)
    .insert({ type, userModel: name, userId: `${user.$id()}`, ...values })
}
