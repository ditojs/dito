import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { isString } from '@ditojs/utils'

// The cost of the hashes, also of the dummy one.
const hashRounds = 10
let dummyHash: Promise<string> | null = null

export function hashPassword(password: string) {
  return bcrypt.hash(password, hashRounds)
}

// Compares against a dummy hash for unknown users and users without a
// password, so the time of the answer doesn't tell which usernames exist.
// Passwords that aren't strings are wrong.
export async function verifyPassword(
  password: unknown,
  hash: string | null | undefined
) {
  dummyHash ??= bcrypt.hash('', hashRounds)
  const compared = hash || (await dummyHash)
  return (
    isString(password) &&
    (await bcrypt.compare(password as string, compared)) &&
    !!hash
  )
}

// Sessions keep a hash of the password hash, so a password change ends the
// other sessions of the user.
export function getPasswordFingerprint(hash: string | null | undefined) {
  return hash ? createHash('sha256').update(hash).digest('base64url') : null
}
