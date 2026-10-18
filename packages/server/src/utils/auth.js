import { createHash } from 'node:crypto'

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
export function getPasswordFingerprint(hash) {
  return hash ? createHash('sha256').update(hash).digest('base64url') : null
}

export function getTotpQuery(user, trx) {
  return user.constructor
    .credentialQuery(trx)
    .where({ type: 'totp', userId: `${user.$id()}` })
}
