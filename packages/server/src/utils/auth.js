import { createHash } from 'node:crypto'
import { asArray } from '@ditojs/utils'

// The time to answer passkey challenges, and to complete TOTP setups and the
// logins of users with TOTP:
export const authTimeout = 5 * 60 * 1000 // 5 minutes

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

// Sessions can be stored in cookies, so they store a hash of the password hash,
// not the hash itself:
export function getPasswordFingerprint(user) {
  return user?.hash
    ? createHash('sha256').update(user.hash).digest('base64url')
    : null
}

// Keep the session of the logged-in user after changing their password among
// `users`, while their other sessions end. Users written through scopes
// without `hash` load it, if they still exist:
export async function updatePasswordFingerprint(ctx, users) {
  const { passport } = ctx.session
  const user = asArray(users).find(
    user => passport?.user === getUserIdentifier(user)
  )
  if (user) {
    passport.passwordFingerprint = getPasswordFingerprint(
      user.hash !== undefined
        ? user
        : await user.constructor
            .query(ctx.transaction)
            .ignoreScope()
            .findById(user.$id())
            .select('hash')
    )
  }
}

export function getTotpQuery(user, trx) {
  return user.constructor
    .credentialQuery(trx)
    .where({ type: 'totp', userId: `${user.$id()}` })
}
