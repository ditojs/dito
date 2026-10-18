import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes
} from 'node:crypto'
import { Service } from './Service.js'
import { AuthenticationError, ResponseError } from '../errors/index.js'
import {
  authenticationTimeout,
  getCredentialQuery,
  getUserIdentifier,
  insertCredential
} from '../utils/authentication.js'
import { importPeer } from '../utils/module.js'

export class TotpService extends Service {
  #otpAuth

  // @override
  async initialize() {
    if (!this.app.config.app.name) {
      throw new Error(`Invalid TOTP, missing 'app.name'.`)
    }
    if (!this.config.secret) {
      throw new Error(`Invalid TOTP, missing 'services.${this.name}.secret'.`)
    }
    this.#otpAuth = await importPeer(this, 'otpauth')
  }

  // Create a new secret, with the URI for the QR code of authenticator apps,
  // and keep it in the session until the user confirms it with a code:
  createSecret(ctx, user) {
    const { base32: secret } = new this.#otpAuth.Secret()
    ctx.session.pendingTotp = {
      secret,
      expires: Date.now() + authenticationTimeout
    }
    return { uri: this.#createTotp(user, secret).toString(), secret }
  }

  // Store the secret of the session once the user confirms it with a code,
  // along with backup codes, which we return:
  async confirmSecret(ctx, user, code) {
    const { pendingTotp } = ctx.session
    if (!(pendingTotp?.expires > Date.now())) {
      throw new AuthenticationError({
        message: 'Missing or expired TOTP confirmation',
        status: 400
      })
    }
    const { credentialClass } = user.constructor
    return credentialClass.transaction(ctx.transaction, async trx => {
      // Lock the user against concurrent confirmations, without its scopes:
      await user.$query(trx).ignoreScope().forUpdate()
      if (await getCredentialQuery(user, 'totp', trx).first()) {
        throw new ResponseError({
          message: 'TOTP is already set up',
          status: 409
        })
      }
      const { secret } = pendingTotp
      const step = this.#getCodeStep(user, secret, code)
      if (step !== null) {
        const key = this.config.secret
        const backupCodes = Array.from({ length: backupCodeCount }, () => {
          // 40 random bits, as two groups of five hex digits:
          const code = randomBytes(5).toString('hex')
          return `${code.slice(0, 5)}-${code.slice(5)}`
        })
        await insertCredential(
          user,
          'totp',
          {
            data: {
              secret: encrypt(key, secret, user),
              // The confirmed code can't be used again:
              step,
              backupCodes: backupCodes.map(code => hashBackupCode(key, code))
            }
          },
          trx
        )
        delete ctx.session.pendingTotp
        return backupCodes
      } else {
        // Wrong codes don't count, as the user already knows the secret.
        throw new AuthenticationError('Code is incorrect')
      }
    })
  }

  // Verify a TOTP code, or consume a backup code of the user. Too many wrong
  // codes in a row lock the account for a while. We lock the TOTP credential
  // meanwhile, against concurrent requests that use the same code or miss a
  // failure:
  async verifyCode(ctx, user, code) {
    const key = this.config.secret
    const { isValid, isLocked } = await user.constructor.credentialClass
      .transaction(ctx.transaction, async trx => {
        const totp = await getCredentialQuery(user, 'totp', trx)
          .forUpdate()
          .first()
        if (totp) {
          const { data } = totp
          if (data.lockedUntil > Date.now()) {
            return { isValid: false, isLocked: true }
          }
          const step = this.#getCodeStep(
            user,
            decrypt(key, data.secret, user),
            code
          )
          const hash = hashBackupCode(key, code)
          // Each code is only accepted once, and backup codes are removed:
          const isTotpCode = step !== null && step > data.step
          const isBackupCode = !isTotpCode && data.backupCodes.includes(hash)
          const isValid = isTotpCode || isBackupCode
          const failures = isValid ? 0 : (data.failures ?? 0) + 1
          const isLocked = failures >= maxCodeFailures
          await totp.$query(trx).patch({
            data: {
              ...data,
              step: isTotpCode ? step : data.step,
              backupCodes: isBackupCode
                ? data.backupCodes.filter(backupCode => backupCode !== hash)
                : data.backupCodes,
              // The count starts anew once the lock ends:
              failures: isLocked ? 0 : failures,
              lockedUntil: isLocked ? Date.now() + codeLockTime : null
            },
            ...(isTotpCode && { lastUsedAt: new Date() })
          })
          return { isValid, isLocked }
        } else {
          return { isValid: false, isLocked: false }
        }
      })
    // Throw after the transaction, which keeps the failures:
    if (isLocked) {
      // The attempt that uses up the limit answers it too, and clients don't
      // ask for another code:
      throw new AuthenticationError({
        message: 'Too many attempts',
        status: 400
      })
    }
    if (!isValid) {
      throw new AuthenticationError('Code is incorrect')
    }
  }

  #createTotp(user, secret) {
    const { usernameProperty } = user.constructor.definition.options
    return new this.#otpAuth.TOTP({
      issuer: this.app.config.app.name,
      label: user[usernameProperty],
      secret
    })
  }

  // Return the time step of a valid code, or `null`. Accept the previous and
  // the next code too, for clocks that drift:
  #getCodeStep(user, secret, code) {
    const totp = this.#createTotp(user, secret)
    const timestamp = Date.now()
    const delta = totp.validate({ token: `${code}`, timestamp, window: 1 })
    return delta !== null ? totp.counter({ timestamp }) + delta : null
  }
}

// Wrong TOTP and backup codes in a row lock the account for a while:
const maxCodeFailures = 10
const codeLockTime = 15 * 60 * 1000 // 15 minutes

const backupCodeCount = 10

// The lengths of the IV and the authentication tag of AES-256-GCM:
const ivLength = 12
const tagLength = 16

// The secret of the service is a long random string: HKDF suffices to derive
// a key from it for each use:
function deriveKey(key, use) {
  return Buffer.from(hkdfSync('sha256', key, 'dito-credentials', use, 32))
}

// Encrypt with AES-256-GCM, with a random IV and the authentication tag stored
// before the encrypted value. The user is authenticated data, so the value
// can't be moved to other users:
function encrypt(key, value, user) {
  const iv = randomBytes(ivLength)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(key, 'totp'), iv)
  cipher.setAAD(Buffer.from(getUserIdentifier(user)))
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
}

function decrypt(key, value, user) {
  const buffer = Buffer.from(value, 'base64')
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(key, 'totp'),
    buffer.subarray(0, ivLength)
  )
  decipher.setAAD(Buffer.from(getUserIdentifier(user)))
  decipher.setAuthTag(buffer.subarray(ivLength, ivLength + tagLength))
  return Buffer.concat([
    decipher.update(buffer.subarray(ivLength + tagLength)),
    decipher.final()
  ]).toString('utf8')
}

// Backup codes are random, so a fast hash suffices. Keyed with the secret of
// the service, a leaked database alone doesn't allow guessing them:
function hashBackupCode(key, code) {
  return createHmac('sha256', deriveKey(key, 'backup-code'))
    .update(`${code}`.toLowerCase().replace(/[^0-9a-f]/g, ''))
    .digest('hex')
}
