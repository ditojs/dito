import bcrypt from 'bcryptjs'
import { isString } from '@ditojs/utils'

// The cost of the hashes, including the dummy one.
const hashRounds = 10
let dummyHash: Promise<string> | null = null

export function hashPassword(password: string) {
  return bcrypt.hash(password, hashRounds)
}

// Compares against a dummy hash for unknown users and users without a password,
// so that the response time doesn't reveal which usernames exist. Passwords
// that aren't strings are wrong.
export async function verifyPassword(
  password: unknown,
  hash: string | null | undefined
) {
  dummyHash ??= bcrypt.hash('', hashRounds)
  const compared = hash || (await dummyHash)
  return (
    isString(password) &&
    (await bcrypt.compare(password, compared)) &&
    !!hash
  )
}
