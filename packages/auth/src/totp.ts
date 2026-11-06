import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes
} from 'node:crypto'
import type { Kysely } from 'kysely'
import { Secret, TOTP } from 'otpauth'
import type { Context } from 'hono'
import { createAuthError, authenticationTimeout } from './authentication.ts'
import type { Credentials } from './credentials.ts'
import { getSession } from './sessions.ts'
import { getUserIdentifier, type User } from './users.ts'

// TOTP as a credential of type `totp`, with its secret encrypted.

export interface TotpOptions {
  // The name that authenticator apps show, such as the app's name.
  issuer: string
  // A long random string of the app, from which HKDF derives the keys.
  secret: string
}

// Wrong codes in a row lock the codes for a while:
const maxCodeFailures = 10
const codeLockDuration = 15 * 60 * 1000
const backupCodeCount = 10
// The lengths of the IV and the authentication tag of AES-256-GCM.
const ivLength = 12
const tagLength = 16

interface CreateTotpOptions extends TotpOptions {
  credentials: Credentials
}

export function createTotp({
  issuer,
  secret: key,
  credentials
}: CreateTotpOptions) {
  if (!key) throw new Error('Unable to use TOTP without a secret.')
  // Accept the previous and the next code too, for clocks that drift.
  function getCodeStep(secret: string, code: unknown) {
    const totp = new TOTP({ issuer, secret })
    const timestamp = Date.now()
    const delta = totp.validate({ token: `${code}`, timestamp, window: 1 })
    return delta !== null ? totp.counter({ timestamp }) + delta : null
  }

  return {
    // Keep the secret in the session until the user confirms it with a code.
    createSecret(c: Context, user: User) {
      const { base32: secret } = new Secret()
      getSession(c).value.pendingTotp = {
        secret,
        expires: Date.now() + authenticationTimeout
      }
      const label = credentials.source.getUsername(user)
      const uri = new TOTP({ issuer, label, secret }).toString()
      return { uri, secret }
    },

    async confirmSecret(c: Context, user: User, code: unknown) {
      const { value } = getSession(c)
      const { pendingTotp } = value
      if (!(pendingTotp?.expires > Date.now())) {
        throw createAuthError('Missing or expired TOTP confirmation', 400)
      }
      const identifier = getUserIdentifier(credentials.source, user)
      const createConflictError = () =>
        createAuthError('TOTP is already set up', 409)
      if (await credentials.findFirst(user, 'totp')) {
        throw createConflictError()
      }
      const { secret } = pendingTotp
      const step = getCodeStep(secret, code)
      // Wrong codes don't count, as the user already knows the secret.
      if (step === null) throw createAuthError('Code is incorrect')
      const backupCodes = Array.from({ length: backupCodeCount }, () => {
        // 40 random bits, as two groups of five hex digits.
        const code = randomBytes(5).toString('hex')
        return `${code.slice(0, 5)}-${code.slice(5)}`
      })
      try {
        await credentials.insert(user, 'totp', {
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
        if (await credentials.findFirst(user, 'totp')) {
          throw createConflictError()
        }
        throw error
      }
      delete value.pendingTotp
      return backupCodes
    },

    // Lock the credential in a transaction of its own, against concurrent
    // requests that use the same code or miss a failure, and so that failures
    // stay counted when the request fails.
    async verifyCode(user: User, code: unknown) {
      const identifier = getUserIdentifier(credentials.source, user)
      const verify = async (trx: Kysely<any>) => {
        const totp = await credentials.findFirst(user, 'totp', { trx })
        if (!totp) return { isValid: false, isLocked: false }
        const { data } = totp
        if (data.lockedUntil > Date.now()) {
          return { isValid: false, isLocked: true }
        }
        const secret = decrypt(key, data.secret, identifier)
        const step = getCodeStep(secret, code)
        const hash = hashBackupCode(key, code)
        // Each code is accepted once, and backup codes are removed.
        const isTotpCode = step !== null && step > data.step
        const isBackupCode = !isTotpCode && data.backupCodes.includes(hash)
        const isValid = isTotpCode || isBackupCode
        const failures = isValid ? 0 : (data.failures ?? 0) + 1
        const isLocked = failures >= maxCodeFailures
        await credentials.update(
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
              lockedUntil: isLocked ? Date.now() + codeLockDuration : null
            },
            ...(isTotpCode && { lastUsedAt: new Date() })
          },
          { trx }
        )
        return { isValid, isLocked }
      }
      const { isValid, isLocked } = await credentials
        .getKysely()
        .transaction()
        .execute(verify)
      // Report the lock already on the attempt that uses up the limit, so
      // clients don't ask for another code:
      if (isLocked) throw createAuthError('Too many attempts', 400)
      if (!isValid) throw createAuthError('Code is incorrect')
    }
  }
}

function deriveKey(key: string, use: string) {
  return Buffer.from(hkdfSync('sha256', key, 'dito-credentials', use, 32))
}

// Encrypt with AES-256-GCM, and put the IV and the authentication tag before
// the value. The user's identifier is authenticated data, so the value can't
// move to other users.
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
