// The time to answer passkey challenges, and to complete TOTP setups and the
// logins of users with TOTP:
export const authTimeout = 5 * 60 * 1000 // 5 minutes

export function getTotpQuery(user, trx) {
  return user.constructor
    .credentialQuery(trx)
    .where('userId', `${user.$id()}`)
    .whereIn('type', ['totp', 'backup-code'])
}
