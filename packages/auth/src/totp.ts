import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes
} from 'node:crypto'
import type { Kysely } from 'kysely'
import type { Credentials } from './credentials.ts'
import { authError } from './errors.ts'
import { authenticationTimeout, getUserIdentifier } from './identifiers.ts'
import { lazyPeer } from './peers.ts'
import type { AnyContext, SessionValue, UserSource } from './types.ts'

// TOTP as Dito 6's `TotpService` stores it: a credential of type `totp` with
// the secret encrypted by AES-256-GCM, the user's identifier as authenticated
// data, the last accepted time step, and HMAC hashes of the backup codes. Ten
// wrong codes in a row lock the codes for 15 minutes. `secret` is a long
// random string of the app, from which HKDF derives the keys.

export interface TotpOptions {
  // The name that authenticator apps show, such as the app's name.
  issuer: string
  secret: string
}

export type Totp = ReturnType<typeof totp>

const maxCodeFailures = 10
const codeLockTime = 15 * 60 * 1000
const backupCodeCount = 10
// The lengths of the IV and the authentication tag of AES-256-GCM.
const ivLength = 12
const tagLength = 16

export function totp({ issuer, secret: key }: TotpOptions) {
  if (!key) throw new Error('Unable to use TOTP without a secret.')
  const otpAuth = lazyPeer<typeof import('otpauth')>('otpauth', 'TOTP')

  async function createTotp(label: string, secret: string) {
    const { TOTP } = await otpAuth()
    return new TOTP({ issuer, label, secret })
  }

  // The time step of a valid code, or null. It accepts the previous and the
  // next code too, for clocks that drift.
  async function getCodeStep(label: string, secret: string, code: unknown) {
    const totp = await createTotp(label, secret)
    const timestamp = Date.now()
    const delta = totp.validate({ token: `${code}`, timestamp, window: 1 })
    return delta !== null ? totp.counter({ timestamp }) + delta : null
  }

  return {
    // Creates a secret, with the URI for the QR code of authenticator apps,
    // and keeps it in the session until the user confirms it with a code.
    async createSecret(
      session: SessionValue,
      source: UserSource,
      user: unknown
    ) {
      const { Secret } = await otpAuth()
      const { base32: secret } = new Secret()
      session.pendingTotp = {
        secret,
        expires: Date.now() + authenticationTimeout
      }
      const { username } = source.describe(user)
      return { uri: (await createTotp(username, secret)).toString(), secret }
    },

    // Stores the secret of the session once the user confirms it with a code,
    // along with backup codes, which it returns.
    async confirmSecret(
      c: AnyContext,
      session: SessionValue,
      credentials: Credentials,
      source: UserSource,
      user: unknown,
      code: unknown
    ) {
      const { pendingTotp } = session
      if (!(pendingTotp?.expires > Date.now())) {
        throw authError('Missing or expired TOTP confirmation', 400)
      }
      const identifier = getUserIdentifier(source, user)
      const conflict = () => authError('TOTP is already set up', 409)
      if (await credentials.first(c, source, user, 'totp')) throw conflict()
      const { secret } = pendingTotp
      const step = await getCodeStep(
        source.describe(user).username,
        secret,
        code
      )
      // Wrong codes don't count, as the user already knows the secret.
      if (step === null) throw authError('Code is incorrect')
      const backupCodes = Array.from({ length: backupCodeCount }, () => {
        // 40 random bits, as two groups of five hex digits.
        const code = randomBytes(5).toString('hex')
        return `${code.slice(0, 5)}-${code.slice(5)}`
      })
      try {
        await credentials.insert(c, source, user, 'totp', {
          // The key is unique per source, so one of two concurrent
          // confirmations fails.
          key: `totp-${identifier}`,
          data: {
            secret: encrypt(key, secret, identifier),
            // The confirmed code can't be used again.
            step,
            backupCodes: backupCodes.map(code => hashBackupCode(key, code))
          }
        })
      } catch (error) {
        if (await credentials.first(c, source, user, 'totp')) throw conflict()
        throw error
      }
      delete session.pendingTotp
      return backupCodes
    },

    // Verifies a TOTP code, or consumes a backup code. It locks the credential
    // meanwhile, against concurrent requests that use the same code or miss a
    // failure. It runs in the transaction of `credentials.db(c)` if that is
    // one, and in its own otherwise, which keeps the failures when the
    // request fails.
    async verifyCode(
      c: AnyContext,
      credentials: Credentials,
      source: UserSource,
      user: unknown,
      code: unknown
    ) {
      const db = credentials.db(c)
      const identifier = getUserIdentifier(source, user)
      const { username } = source.describe(user)
      const verify = async (trx: Kysely<any>) => {
        const totp = await credentials.first(c, source, user, 'totp', {
          database: trx,
          forUpdate: true
        })
        if (!totp) return { isValid: false, isLocked: false }
        const { data } = totp
        if (data.lockedUntil > Date.now()) {
          return { isValid: false, isLocked: true }
        }
        const secret = decrypt(key, data.secret, identifier)
        const step = await getCodeStep(username, secret, code)
        const hash = hashBackupCode(key, code)
        // Each code is accepted once, and backup codes are removed.
        const isTotpCode = step !== null && step > data.step
        const isBackupCode = !isTotpCode && data.backupCodes.includes(hash)
        const isValid = isTotpCode || isBackupCode
        const failures = isValid ? 0 : (data.failures ?? 0) + 1
        const isLocked = failures >= maxCodeFailures
        await credentials.update(
          c,
          totp.id,
          {
            data: {
              ...data,
              step: isTotpCode ? step : data.step,
              backupCodes: isBackupCode
                ? data.backupCodes.filter((code: string) => code !== hash)
                : data.backupCodes,
              // The count starts anew once the lock ends.
              failures: isLocked ? 0 : failures,
              lockedUntil: isLocked ? Date.now() + codeLockTime : null
            },
            ...(isTotpCode && { lastUsedAt: new Date() })
          },
          trx
        )
        return { isValid, isLocked }
      }
      const { isValid, isLocked } = db.isTransaction
        ? await verify(db)
        : await db.transaction().execute(verify)
      // The attempt that uses up the limit answers it too, so clients don't
      // ask for another code.
      if (isLocked) throw authError('Too many attempts', 400)
      if (!isValid) throw authError('Code is incorrect')
    }
  }
}

function deriveKey(key: string, use: string) {
  return Buffer.from(hkdfSync('sha256', key, 'dito-credentials', use, 32))
}

// The IV and the authentication tag come before the encrypted value. The
// user's identifier is authenticated data, so the value can't move to other
// users.
function encrypt(key: string, value: string, identifier: string) {
  const iv = randomBytes(ivLength)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(key, 'totp'), iv)
  cipher.setAAD(Buffer.from(identifier))
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
}

function decrypt(key: string, value: string, identifier: string) {
  const buffer = Buffer.from(value, 'base64')
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(key, 'totp'),
    buffer.subarray(0, ivLength)
  )
  decipher.setAAD(Buffer.from(identifier))
  decipher.setAuthTag(buffer.subarray(ivLength, ivLength + tagLength))
  return Buffer.concat([
    decipher.update(buffer.subarray(ivLength + tagLength)),
    decipher.final()
  ]).toString('utf8')
}

// Backup codes are random, so a fast hash suffices. Keyed with the secret, a
// leaked database alone doesn't allow guessing them.
function hashBackupCode(key: string, code: unknown) {
  return createHmac('sha256', deriveKey(key, 'backup-code'))
    .update(`${code}`.toLowerCase().replace(/[^0-9a-f]/g, ''))
    .digest('hex')
}
