import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual
} from 'node:crypto'
import aaguids from 'aaguids'
import { asArray, isString } from '@ditojs/utils'
import { ModelController } from './ModelController.js'
import {
  getUserIdentifier,
  parseUserIdentifier,
  updatePasswordFingerprint
} from '../middleware/handleUser.js'
import {
  authTimeout,
  backupCodeCount,
  codeLockTime,
  maxCodeFailures
} from '../utils/auth.js'
import { getDuration } from '../utils/duration.js'
import {
  AuthenticationError,
  AuthorizationError,
  ControllerError,
  NotFoundError,
  ResponseError,
  ValidationError
} from '../errors/index.js'

export class UsersController extends ModelController {
  collection = {
    // These actions authenticate users, so the controller's `authorize`
    // setting doesn't apply to them:
    'authorize': {
      'post login': true,
      'post login-code': true,
      'post logout': true,
      'get session': true,
      'post passkey-login-options': true,
      'post passkey-login': true,
      'post password-reset': true,
      'post password-reset-confirm': true,
      // Users manage their own password and passkeys, and need confirmed
      // access to change them:
      'post confirm-access': isAuthenticated,
      'post password': hasConfirmedAccess,
      'get passkeys': isAuthenticated,
      'post passkey-options': hasConfirmedAccess,
      'post passkeys': hasConfirmedAccess,
      'delete passkeys/:id': hasConfirmedAccess,
      // ...and their TOTP:
      'get totp': isAuthenticated,
      'post totp': hasConfirmedAccess,
      'post totp-confirm': hasConfirmedAccess,
      'delete totp': hasConfirmedAccess
    },

    'post login'(ctx) {
      return this.handleLogin(ctx, () => this.modelClass.login(ctx))
    },

    // The second step of password logins of users with TOTP, with a TOTP code
    // or a backup code:
    'post login-code'(ctx) {
      return this.handleLogin(ctx, async () => {
        const { pendingLogin } = ctx.session
        const { modelName, id } = pendingLogin
          ? parseUserIdentifier(pendingLogin.user)
          : {}
        if (
          modelName === this.modelClass.name &&
          pendingLogin.expires > Date.now()
        ) {
          const user = await this.modelClass
            .sessionQuery(ctx.transaction)
            .findById(id)
          const { code } = ctx.request.body
          if (user && (await this.verifyCode(ctx, user, code))) {
            delete ctx.session.pendingLogin
            await ctx.login(user)
            return user
          }
          throw new AuthenticationError('Code is incorrect')
        } else {
          throw new AuthenticationError({
            message: 'Missing or expired login',
            status: 400
          })
        }
      })
    },

    async 'post logout'(ctx) {
      let success = false
      if (this.isAuthenticated(ctx)) {
        await ctx.logout()
        success = ctx.isUnauthenticated()
      }
      return {
        success,
        authenticated: this.isAuthenticated(ctx)
      }
    },

    'get session'(ctx) {
      const authenticated = this.isAuthenticated(ctx)
      return {
        authenticated,
        user: authenticated ? ctx.state.user : null
      }
    },

    // Confirm the access of the logged-in user with their password, and the
    // code of users with TOTP, or with a passkey:
    'post confirm-access': {
      // Actions that count wrong codes or consume challenges are never
      // transacted, so that their failures aren't rolled back:
      transacted: false,

      parameters: {
        password: { type: 'string' },
        code: { type: 'string' },
        passkey: { type: 'object' }
      },

      async handler(ctx, { password, code, passkey }) {
        const { user } = ctx.state
        if (this.passkeys && passkey) {
          if (!(await verifyPasskey(this, ctx, passkey))?.$is(user)) {
            throw new AuthenticationError('Passkey is incorrect')
          }
        } else if (!(password && (await user.$verifyPassword(password)))) {
          throw new AuthenticationError('Password is incorrect')
        } else if (this.totp && (await hasTotp(this.modelClass, ctx))) {
          // Like password logins, ask users with TOTP for a code:
          if (!code) {
            return { success: false, codeRequired: true }
          } else if (!(await this.verifyCode(ctx, user, code))) {
            throw new AuthenticationError('Code is incorrect')
          }
        }
        storeConfirmedAccess(this, ctx, user)
        return { success: true }
      }
    },

    'post password': {
      parameters: {
        currentPassword: { type: 'string', required: true },
        password: { type: 'string', required: true }
      },

      async handler(ctx, { currentPassword, password }) {
        const { user } = ctx.state
        if (await user.$verifyPassword(currentPassword)) {
          const { passwordProperty } = this.modelClass.definition.options
          // The password property validates the password and sets its hash:
          await user
            .$query(ctx.transaction)
            .patch({ [passwordProperty]: password })
          // Keep the session of the user, while their other sessions end:
          updatePasswordFingerprint(ctx, user)
          return { success: true }
        } else {
          throw new AuthenticationError({
            message: 'Password is incorrect',
            status: 400
          })
        }
      }
    },

    // Answer the same whether the user exists or not, so that the answer
    // doesn't tell which usernames exist:
    async 'post password-reset'(ctx) {
      const { modelClass } = this
      const { usernameProperty } = modelClass.definition.options
      const username = ctx.request.body[usernameProperty]
      if (!username || !isString(username)) {
        throw new ResponseError({
          message: `${username ? 'Invalid' : 'Missing'} ${usernameProperty}`,
          status: 400
        })
      }
      const user = await modelClass
        .sessionQuery(ctx.transaction)
        .findOne(usernameProperty, username)
      if (user) {
        const token = createPasswordResetToken(this, user, Date.now())
        const url = this.passwordReset.confirmUrl.replace('{token}', token)
        // Don't wait for the email, so that its failures don't change the
        // answer, also when `sendPasswordReset()` throws right away:
        Promise.resolve()
          .then(() => this.sendPasswordReset(ctx, user, url))
          .catch(err => this.app.emit('error', err, ctx))
      }
      return { success: true }
    },

    'post password-reset-confirm': {
      parameters: {
        token: { type: 'string', required: true },
        password: { type: 'string', required: true }
      },

      async handler(ctx, { token, password }) {
        const user = await findPasswordResetUser(this, ctx, token)
        if (user) {
          const { passwordProperty } = this.modelClass.definition.options
          // The password property validates the password and sets its hash,
          // which ends the other sessions of the user and the link:
          await user
            .$query(ctx.transaction)
            .patch({ [passwordProperty]: password })
          updatePasswordFingerprint(ctx, user)
          return { success: true }
        } else {
          throw new AuthenticationError({
            message: 'Invalid or expired token',
            status: 400
          })
        }
      }
    },

    'get self'(ctx) {
      return this.isAuthenticated(ctx)
        ? this.member.get.call(
            this,
            this.getContextWithMemberId(ctx, ctx.state.user.$id())
          )
        : null
    },

    async 'post passkey-login-options'(ctx) {
      const { generateAuthenticationOptions } = this.webAuthn
      // Passkeys are discoverable, so the browser offers them without a
      // username:
      const options = await generateAuthenticationOptions({
        rpID: this.passkeys.id,
        userVerification: 'required'
      })
      storeChallenge(ctx, 'authentication', options)
      return options
    },

    'post passkey-login'(ctx) {
      return this.handleLogin(ctx, async () => {
        const user = await verifyPasskey(this, ctx, ctx.request.body)
        if (user) {
          await ctx.login(user)
          return user
        }
        throw new AuthenticationError('Passkey is incorrect')
      })
    },

    'get passkeys'(ctx) {
      return getPasskeyQuery(this.modelClass, ctx).select(
        'id',
        'name',
        'createdAt',
        'lastUsedAt'
      )
    },

    async 'post passkey-options'(ctx) {
      const { generateRegistrationOptions } = this.webAuthn
      const { user } = ctx.state
      const { usernameProperty } = this.modelClass.definition.options
      const passkeys = await getPasskeyQuery(this.modelClass, ctx)
      const options = await generateRegistrationOptions({
        rpName: this.passkeys.name,
        rpID: this.passkeys.id,
        userName: user[usernameProperty],
        // Don't register the same authenticator twice:
        excludeCredentials: passkeys.map(({ key, data }) => ({
          id: key,
          transports: data.transports
        })),
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'required'
        }
      })
      storeChallenge(ctx, 'registration', options)
      return options
    },

    'post passkeys': {
      transacted: false, // See 'post confirm-access'.

      async handler(ctx) {
        const { verifyRegistrationResponse } = this.webAuthn
        const verification = await verifyRegistrationResponse({
          response: ctx.request.body,
          expectedChallenge: consumeChallenge(ctx, 'registration'),
          expectedOrigin: this.passkeys.origins,
          expectedRPID: this.passkeys.id
        }).catch(err => {
          // Failed verifications are bad requests, not server errors:
          throw new AuthenticationError({ message: err.message, status: 400 })
        })
        if (verification.verified) {
          const { credential, aaguid } = verification.registrationInfo
          // Name passkeys after their providers, e.g. '1Password'. Anonymous
          // providers send an all-zero AAGUID, which isn't listed:
          const name = aaguids[aaguid] ?? 'Passkey'
          const { id, createdAt } = await this.modelClass.credentialClass
            .query(ctx.transaction)
            .insert({
              type: 'passkey',
              userModel: this.modelClass.name,
              userId: `${ctx.state.user.$id()}`,
              key: credential.id,
              name,
              data: {
                publicKey: Buffer.from(credential.publicKey).toString(
                  'base64url'
                ),
                counter: credential.counter,
                transports: credential.transports
              }
            })
          return { id, name, createdAt, lastUsedAt: null }
        } else {
          throw new AuthenticationError({
            message: 'Passkey is incorrect',
            status: 400
          })
        }
      }
    },

    async 'delete passkeys/:id'(ctx) {
      const count = await getPasskeyQuery(this.modelClass, ctx)
        .deleteById(ctx.params.id)
      if (count > 0) {
        return { success: true }
      } else {
        throw new NotFoundError()
      }
    },

    async 'get totp'(ctx) {
      const { user } = ctx.state
      const credentials = await getTotpQuery(
        this.modelClass,
        user,
        ctx.transaction
      )
      const types = credentials.map(({ type }) => type)
      return {
        enabled: types.includes('totp'),
        backupCodes: types.filter(type => type === 'backup-code').length
      }
    },

    // Keep the new secret in the session until the user confirms it with a
    // code:
    async 'post totp'(ctx) {
      if (await hasTotp(this.modelClass, ctx)) {
        throw new ResponseError({
          message: 'TOTP is already set up',
          status: 409
        })
      }
      const { base32: secret } = new this.otpAuth.Secret()
      ctx.session.totpSetup = {
        secret,
        expires: Date.now() + authTimeout,
        failures: 0
      }
      return {
        uri: createTotp(this, ctx.state.user, secret).toString(),
        secret
      }
    },

    'post totp-confirm': {
      transacted: false, // See 'post confirm-access'.

      async handler(ctx) {
        const { user } = ctx.state
        const { totpSetup } = ctx.session
        if (!(totpSetup?.expires > Date.now())) {
          throw new AuthenticationError({
            message: 'Missing or expired TOTP setup',
            status: 400
          })
        } else if (await hasTotp(this.modelClass, ctx)) {
          throw new ResponseError({
            message: 'TOTP is already set up',
            status: 409
          })
        }
        const { secret } = totpSetup
        const step = validateTotp(
          createTotp(this, user, secret),
          ctx.request.body.code
        )
        if (step !== null) {
          const key = this.app.config.app.auth.secret
          const backupCodes = Array.from({ length: backupCodeCount }, () => {
            // 40 random bits, as two groups of five hex digits:
            const code = randomBytes(5).toString('hex')
            return `${code.slice(0, 5)}-${code.slice(5)}`
          })
          // Store the credentials all together or not at all:
          const { credentialClass } = this.modelClass
          await credentialClass.transaction(ctx.transaction, async trx => {
            // Batch inserts only work on PostgreSQL:
            for (const [type, data] of [
              // The confirmed code can't be used again:
              ['totp', { secret: encrypt(key, secret, user), step }],
              ...backupCodes.map(code => [
                'backup-code',
                { hash: hashBackupCode(key, code) }
              ])
            ]) {
              await credentialClass.query(trx).insert({
                type,
                userModel: this.modelClass.name,
                userId: `${user.$id()}`,
                data
              })
            }
          })
          delete ctx.session.totpSetup
          // The backup codes are stored hashed, so users only see them now:
          return { backupCodes }
        } else if (++totpSetup.failures >= maxCodeFailures) {
          // The setup starts over after too many wrong codes:
          delete ctx.session.totpSetup
          throw createTooManyAttemptsError()
        } else {
          throw new AuthenticationError('Code is incorrect')
        }
      }
    },

    async 'delete totp'(ctx) {
      await getTotpQuery(
        this.modelClass,
        ctx.state.user,
        ctx.transaction
      ).delete()
      return { success: true }
    }
  }

  member = {
    authorize: ['$self']
  }

  // @override
  setup() {
    const { session, auth } = this.app.config.app
    this.passkeys = auth?.passkeys ?? null
    this.totp = auth?.totp ?? null
    this.reconfirmAccessAfter = getDuration(auth?.reconfirmAccessAfter ?? '10m')
    this.passwordReset = auth?.passwordReset
      ? {
          ...auth.passwordReset,
          expiresAfter: getDuration(auth.passwordReset.expiresAfter ?? '1h')
        }
      : null

    // Passkey challenges and pending logins are kept in the session, stored on
    // the server so that old cookies can't replay them, and both need
    // credentials:
    const checkCredentials = name => {
      if (!(session?.modelClass || session?.store || session?.ContextStore)) {
        throw new ControllerError(
          this,
          `Unable to use ${name} without sessions stored on the server, ` +
          `see 'app.session'.`
        )
      } else if (!this.modelClass.credentialClass) {
        throw new ControllerError(
          this,
          `Unable to use ${name} without credentials, see ` +
          `'app.auth.credentials'.`
        )
      }
    }
    // TOTP and password resets use a secret of their own, not `app.keys`,
    // since rotating those would make their credentials and links unusable:
    const checkSecret = name => {
      if (!auth.secret) {
        throw new ControllerError(
          this,
          `Unable to use ${name} without 'app.auth.secret'.`
        )
      }
    }

    if (this.passkeys) {
      checkCredentials('passkeys')
      const missingKey = ['name', 'id', 'origins'].find(
        key => !this.passkeys[key]
      )
      if (missingKey) {
        throw new ControllerError(
          this,
          `Invalid passkeys, missing 'app.auth.passkeys.${missingKey}'.`
        )
      }
    }
    if (this.totp) {
      if (!this.totp.issuer) {
        throw new ControllerError(
          this,
          `Invalid TOTP, missing 'app.auth.totp.issuer'.`
        )
      }
      checkCredentials('TOTP')
      checkSecret('TOTP')
    }
    if (this.passwordReset) {
      if (!this.passwordReset.confirmUrl?.includes('{token}')) {
        throw new ControllerError(
          this,
          `Invalid password reset, 'app.auth.passwordReset.confirmUrl' ` +
          `needs a '{token}' placeholder.`
        )
      }
      checkSecret('password reset')
    }
    // Set up the routes before importing, so that sub-classes that don't await
    // `super.setup()` still get them before `initialize()`, and configuration
    // errors are thrown right away:
    super.setup()
    // Only controllers that route the password reset send its emails, after
    // `allow` and `processValues()`:
    if (
      Object.hasOwn(this.collection, 'post password-reset') &&
      this.sendPasswordReset === UsersController.prototype.sendPasswordReset
    ) {
      throw new ControllerError(
        this,
        `Unable to use password reset without overriding ` +
        `'sendPasswordReset()'.`
      )
    }
    // The libraries are optional peer dependencies, so we only import them
    // when they are used:
    const importModule = (name, module) =>
      import(module).catch(err => {
        throw err.code === 'ERR_MODULE_NOT_FOUND'
          ? new ControllerError(
              this,
              `Unable to use ${name} without '${module}'.`
            )
          : err
      })
    return Promise.all([
      this.passkeys && importModule('passkeys', '@simplewebauthn/server'),
      this.totp && importModule('TOTP', 'otpauth')
    ]).then(([webAuthn, otpAuth]) => {
      this.webAuthn = webAuthn
      this.otpAuth = otpAuth
    })
  }

  // @override
  processValues(values) {
    const processed = super.processValues(values)
    // Without passkeys, TOTP or password reset, we don't route their actions,
    // which are all in `collection`:
    if (values === this.collection) {
      for (const name of [
        ...(this.passkeys ? [] : passkeyActions),
        ...(this.totp ? [] : totpActions),
        ...(this.passwordReset ? [] : passwordResetActions)
      ]) {
        delete processed.values[name]
      }
    }
    return processed
  }

  // @override
  getMemberId(ctx) {
    // `self` stands for the logged-in user in member routes, e.g. in
    // `PATCH /users/self`:
    if (ctx.params[this.idParam] !== 'self') {
      return super.getMemberId(ctx)
    } else if (this.isAuthenticated(ctx)) {
      return ctx.state.user.$id()
    } else {
      throw new AuthorizationError()
    }
  }

  // @override
  async executeAndFetch(action, ctx, modify, body = ctx.request.body) {
    await validateUserChanges(
      this,
      ctx,
      action,
      asArray(body).map(user => [this.getModelId(user), user])
    )
    return super.executeAndFetch(action, ctx, modify, body)
  }

  // @override
  async relateAndFetch(ctx, modify) {
    await validateUserChanges(
      this,
      ctx,
      'relate',
      asArray(ctx.request.body).map(user => [this.getModelId(user), user])
    )
    return super.relateAndFetch(ctx, modify)
  }

  // @override
  async executeAndFetchById(action, ctx, modify, body = ctx.request.body) {
    await validateUserChanges(this, ctx, action, [[ctx.memberId, body]])
    return super.executeAndFetchById(action, ctx, modify, body)
  }

  isAuthenticated(ctx) {
    // Make sure the currently logged in user has the exact model class, since
    // sub-classes have their own tables and ids:
    return (
      ctx.isAuthenticated() &&
      ctx.state.user.constructor === this.modelClass
    )
  }

  // Security changes need a login or a 'post confirm-access' of the user within
  // `app.auth.reconfirmAccessAfter`. Without one, we answer 403 with
  // `confirmationRequired` instead of denying the access:
  hasConfirmedAccess(ctx) {
    if (this.isAuthenticated(ctx)) {
      checkConfirmedAccess(ctx)
      return true
    } else {
      return false
    }
  }

  async handleLogin(ctx, login) {
    let user
    let error
    let codeRequired = false
    try {
      user = await login()
      if (user) {
        await user.$patch({ lastLogin: new Date() }, ctx.transaction)
        storeConfirmedAccess(this, ctx, user)
      } else {
        // `UserMixin.login()` asks users with TOTP for a code first:
        codeRequired = true
      }
    } catch (err) {
      this.app.emit('error', err, ctx)
      user = null
      error = err.data?.message || err.message
      ctx.status = err.status || 401
    }
    const success = !!user
    return {
      success,
      ...(codeRequired && { codeRequired }),
      authenticated: success && this.isAuthenticated(ctx),
      user,
      error
    }
  }

  // Send the user the email with the `url` that resets their password, with
  // `app.auth.passwordReset`:
  // @overridable
  async sendPasswordReset(/* ctx, user, url */) {
    throw new ControllerError(
      this,
      `Unable to send password resets without overriding ` +
      `'sendPasswordReset()'.`
    )
  }

  // Password reset links only work while these values of the user stay the
  // same, so that a login, a password change or a username change invalidates
  // them:
  // @overridable
  getPasswordResetTokenValues(user) {
    const { usernameProperty } = this.modelClass.definition.options
    return [user.hash, user.lastLogin, user[usernameProperty]]
  }

  // Verify a TOTP code, or consume a backup code of the user. Too many wrong
  // codes in a row lock the account for a while. The credentials stay locked
  // meanwhile, so that concurrent requests can't use the same code or miss a
  // failure:
  async verifyCode(ctx, user, code) {
    const key = this.app.config.app.auth.secret
    const { isValid, isLocked } = await this.modelClass.credentialClass
      .transaction(ctx.transaction, async trx => {
        const credentials = await getTotpQuery(
          this.modelClass,
          user,
          trx
        ).forUpdate()
        const totp = credentials.find(({ type }) => type === 'totp')
        if (totp) {
          const { data } = totp
          if (data.lockedUntil > Date.now()) {
            return { isValid: false, isLocked: true }
          }
          const step = validateTotp(
            createTotp(this, user, decrypt(key, data.secret, user)),
            code
          )
          const hash = hashBackupCode(key, code)
          const backupCode = credentials.find(
            ({ type, data }) => type === 'backup-code' && data.hash === hash
          )
          // Each code is only accepted once, and backup codes are deleted:
          const isTotpCode = step !== null && step > data.step
          const isValid = isTotpCode || !!backupCode
          if (backupCode && !isTotpCode) {
            await backupCode.$query(trx).delete()
          }
          const failures = isValid ? 0 : (data.failures ?? 0) + 1
          const isLocked = failures >= maxCodeFailures
          await totp.$query(trx).patch({
            data: {
              ...data,
              step: isTotpCode ? step : data.step,
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
      throw createTooManyAttemptsError()
    }
    return isValid
  }
}

// Only routed with `app.auth.passkeys`, as they import the optional peer
// dependency `@simplewebauthn/server`:
const passkeyActions = [
  'post passkey-login-options',
  'post passkey-login',
  'get passkeys',
  'post passkey-options',
  'post passkeys',
  'delete passkeys/:id'
]

// Only routed with `app.auth.totp`, as they import the optional peer
// dependency `otpauth`:
const totpActions = [
  'post login-code',
  'get totp',
  'post totp',
  'post totp-confirm',
  'delete totp'
]

// Only routed with `app.auth.passwordReset`, as apps send the emails:
const passwordResetActions = [
  'post password-reset',
  'post password-reset-confirm'
]

// The lengths of the IV and the authentication tag of AES-256-GCM:
const ivLength = 12
const tagLength = 16

// Called with the controller as `this` through `processAuthorize()`:
function isAuthenticated(ctx) {
  return this.isAuthenticated(ctx)
}

function hasConfirmedAccess(ctx) {
  return this.hasConfirmedAccess(ctx)
}

function getPasskeyQuery(modelClass, ctx) {
  return modelClass.credentialQuery(ctx.transaction).where({
    type: 'passkey',
    userId: `${ctx.state.user.$id()}`
  })
}

// Registrations and authentications keep their challenges apart, so that
// confirming the access with a passkey doesn't end a pending registration:
function storeChallenge(ctx, type, { challenge }) {
  ctx.session[`${type}Challenge`] = {
    challenge,
    expires: Date.now() + authTimeout
  }
}

// Each challenge can only be answered once, before it expires:
function consumeChallenge(ctx, type) {
  const key = `${type}Challenge`
  const { challenge, expires } = ctx.session[key] ?? {}
  delete ctx.session[key]
  if (challenge && expires > Date.now()) {
    return challenge
  } else {
    throw new AuthenticationError({
      message: 'Missing or expired passkey challenge',
      status: 400
    })
  }
}

// Verify the response of `startAuthentication()` against the challenge in the
// session, and resolve to the user of the passkey, or `null`:
async function verifyPasskey(controller, ctx, response) {
  const { modelClass, passkeys, webAuthn } = controller
  const challenge = consumeChallenge(ctx, 'authentication')
  const credential = await modelClass
    .credentialQuery(ctx.transaction)
    .findOne({ type: 'passkey', key: response.id ?? null })
  const user = credential
    ? await modelClass.sessionQuery(ctx.transaction).findById(credential.userId)
    : null
  if (user) {
    const { publicKey, counter, transports } = credential.data
    const { verified, authenticationInfo } = await webAuthn
      .verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: passkeys.origins,
        expectedRPID: passkeys.id,
        credential: {
          id: credential.key,
          publicKey: Buffer.from(publicKey, 'base64url'),
          counter,
          transports
        }
      })
      .catch(err => {
        // Don't tell clients why, but keep the reason for the logs:
        throw new AuthenticationError({
          message: 'Passkey is incorrect',
          cause: err
        })
      })
    if (verified) {
      await credential.$patch(
        {
          data: {
            ...credential.data,
            counter: authenticationInfo.newCounter
          },
          lastUsedAt: new Date()
        },
        ctx.transaction
      )
      return user
    }
  }
  return null
}

// The attempt that uses up the limit answers it too, so that clients don't ask
// for another code:
function createTooManyAttemptsError() {
  return new AuthenticationError({ message: 'Too many attempts', status: 400 })
}

function getTotpQuery(modelClass, user, trx) {
  return modelClass
    .credentialQuery(trx)
    .where('userId', `${user.$id()}`)
    .whereIn('type', ['totp', 'backup-code'])
}

async function hasTotp(modelClass, ctx) {
  return !!(await getTotpQuery(
    modelClass,
    ctx.state.user,
    ctx.transaction
  ).findOne({ type: 'totp' }))
}

function createTotp(controller, user, secret) {
  const { usernameProperty } = controller.modelClass.definition.options
  return new controller.otpAuth.TOTP({
    issuer: controller.totp.issuer,
    label: user[usernameProperty],
    secret
  })
}

// Return the time step of a valid code, or `null`. Accept the previous and the
// next code too, for clocks that drift:
function validateTotp(totp, code) {
  const timestamp = Date.now()
  const delta = totp.validate({ token: `${code}`, timestamp, window: 1 })
  return delta !== null ? totp.counter({ timestamp }) + delta : null
}

// `app.auth.secret` is a long random string, so HKDF suffices to derive a key
// for each use:
function deriveKey(secret, use) {
  return Buffer.from(hkdfSync('sha256', secret, 'dito-auth', use, 32))
}

// Encrypt with AES-256-GCM, with a random IV and the authentication tag stored
// before the encrypted value. The user is authenticated data, so the value
// can't be moved to other users:
function encrypt(secret, value, user) {
  const iv = randomBytes(ivLength)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret, 'totp'), iv)
  cipher.setAAD(Buffer.from(getUserIdentifier(user)))
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
}

function decrypt(secret, value, user) {
  const buffer = Buffer.from(value, 'base64')
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(secret, 'totp'),
    buffer.subarray(0, ivLength)
  )
  decipher.setAAD(Buffer.from(getUserIdentifier(user)))
  decipher.setAuthTag(buffer.subarray(ivLength, ivLength + tagLength))
  return Buffer.concat([
    decipher.update(buffer.subarray(ivLength + tagLength)),
    decipher.final()
  ]).toString('utf8')
}

// Passwords are set when users are created, but only change through
// 'post password', which needs confirmed access and the current password, and
// their hashes are never set directly. Usernames only change with confirmed
// access, as password resets go to them. `users` are `[id, user]` entries:
async function validateUserChanges(controller, ctx, action, users) {
  const { modelClass } = controller
  const { usernameProperty, passwordProperty } = modelClass.definition.options
  for (const [id, user] of users) {
    // Relating users with ids updates them:
    const isInsert = action === 'insert' || action === 'relate' && id == null
    const property =
      user?.hash !== undefined
        ? 'hash'
        : !isInsert && user?.[passwordProperty] !== undefined
          ? passwordProperty
          : null
    if (property) {
      throw new ValidationError({
        type: 'BodyValidation',
        message: `Unable to change '${property}' outside of 'post password'`
      })
    }
    const username = user?.[usernameProperty]
    if (!isInsert && username !== undefined) {
      const stored = await modelClass.query(ctx.transaction).findById(id)
      if (stored?.[usernameProperty] !== username) {
        checkConfirmedAccess(ctx)
      }
    }
  }
}

// Answer 403 with `confirmationRequired` to users without a login or a
// 'post confirm-access' within `app.auth.reconfirmAccessAfter`:
function checkConfirmedAccess(ctx) {
  const { user, expires } = ctx.session?.confirmedAccess ?? {}
  if (
    !ctx.state.user ||
    user !== getUserIdentifier(ctx.state.user) ||
    !(expires > Date.now())
  ) {
    throw new AuthorizationError({
      message: 'Confirmation required',
      status: 403,
      confirmationRequired: true
    })
  }
}

function storeConfirmedAccess(controller, ctx, user) {
  ctx.session.confirmedAccess = {
    user: getUserIdentifier(user),
    expires: Date.now() + controller.reconfirmAccessAfter
  }
}

// Tokens carry the user's id and their creation time, with a MAC that also
// covers the values of the user, so that nothing is stored. Dates count as ISO
// strings, missing values as `null`:
function createPasswordResetToken(controller, user, time) {
  const { secret } = controller.app.config.app.auth
  const values = controller.getPasswordResetTokenValues(user)
  const id = Buffer.from(`${user.$id()}`).toString('base64url')
  const mac = createHmac('sha256', deriveKey(secret, 'password-reset'))
    .update(JSON.stringify([getUserIdentifier(user), time, ...values]))
    .digest('base64url')
  return `${id}.${time.toString(36)}.${mac}`
}

// Find the user of a token that hasn't expired, by recreating it:
async function findPasswordResetUser(controller, ctx, token) {
  const [encodedId, encodedTime] = token.split('.')
  const time = parseInt(encodedTime, 36)
  if (Date.now() - time < controller.passwordReset.expiresAfter) {
    try {
      const id = Buffer.from(encodedId, 'base64url').toString()
      const user = await controller.modelClass
        .sessionQuery(ctx.transaction)
        .findById(controller.validateId(id))
      const expected = Buffer.from(
        user ? createPasswordResetToken(controller, user, time) : ''
      )
      const actual = Buffer.from(token)
      const isValid = (
        expected.length === actual.length &&
        timingSafeEqual(expected, actual)
      )
      return isValid ? user : null
    } catch (err) {
      // Tampered tokens may carry invalid ids:
      if (err instanceof ValidationError) {
        return null
      } else {
        throw err
      }
    }
  } else {
    return null
  }
}

// Backup codes are random, so a fast hash suffices. Keyed with the secret, a
// leaked database alone doesn't allow guessing them:
function hashBackupCode(secret, code) {
  return createHmac('sha256', deriveKey(secret, 'backup-code'))
    .update(`${code}`.toLowerCase().replace(/[^0-9a-f]/g, ''))
    .digest('hex')
}
