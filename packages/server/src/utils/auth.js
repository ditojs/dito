// The time to answer passkey challenges, and to complete TOTP setups and the
// logins of users with TOTP:
export const authTimeout = 5 * 60 * 1000 // 5 minutes

// Wrong TOTP and backup codes in a row lock the account for a while:
export const maxCodeFailures = 10
export const codeLockTime = 15 * 60 * 1000 // 15 minutes

export const backupCodeCount = 10

// Users get at most one password reset email in this time:
export const passwordResetInterval = 60 * 1000 // 1 minute
