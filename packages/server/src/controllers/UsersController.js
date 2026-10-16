import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes
} from 'node:crypto'
import { ModelController } from './ModelController.js'
import {
  AuthenticationError,
  AuthorizationError,
  ControllerError,
  NotFoundError,
  ResponseError
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
      // Users manage their own passkeys:
      'get passkeys': ctx => this.isAuthenticated(ctx),
      'post passkey-options': ctx => this.isAuthenticated(ctx),
      'post passkeys': ctx => this.isAuthenticated(ctx),
      'delete passkeys/:id': ctx => this.isAuthenticated(ctx),
      // ...and their TOTP:
      'get totp': ctx => this.isAuthenticated(ctx),
      'post totp': ctx => this.isAuthenticated(ctx),
      'post totp-confirm': ctx => this.isAuthenticated(ctx),
      'delete totp': ctx => this.isAuthenticated(ctx)
    },

    'post login'(ctx) {
      return this.handleLogin(ctx, () => this.modelClass.login(ctx))
    },

    // The second step of password logins of users with TOTP, with a TOTP code
    // or a backup code:
    'post login-code'(ctx) {
      return this.handleLogin(ctx, async () => {
        const { pendingLogin } = ctx.session
        // Only split at the first hyphen, like `handleUser()`:
        const [, modelName, id] = (
          pendingLogin?.user.match(/^([^-]+)-(.+)$/) ?? []
        )
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
          // After too many wrong codes, the password is needed again:
          if (--pendingLogin.attempts <= 0) {
            delete ctx.session.pendingLogin
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
      storeChallenge(ctx, options)
      return options
    },

    'post passkey-login'(ctx) {
      return this.handleLogin(ctx, async () => {
        const { verifyAuthenticationResponse } = this.webAuthn
        const response = ctx.request.body
        const challenge = consumeChallenge(ctx)
        const credential = await this.modelClass
          .credentialQuery(ctx.transaction)
          .findOne({ type: 'passkey', key: response.id ?? null })
        const user = credential
          ? await this.modelClass
              .sessionQuery(ctx.transaction)
              .findById(credential.userId)
          : null
        if (user) {
          const { publicKey, counter, transports } = credential.data
          const { verified, authenticationInfo } =
            await verifyAuthenticationResponse({
              response,
              expectedChallenge: challenge,
              expectedOrigin: this.passkeys.origins,
              expectedRPID: this.passkeys.id,
              credential: {
                id: credential.key,
                publicKey: Buffer.from(publicKey, 'base64url'),
                counter,
                transports
              }
            }).catch(err => {
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
            await ctx.login(user)
            return user
          }
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
      storeChallenge(ctx, options)
      return options
    },

    async 'post passkeys'(ctx) {
      const { verifyRegistrationResponse } = this.webAuthn
      const { name = null, response } = ctx.request.body
      const { verified, registrationInfo } = await verifyRegistrationResponse({
        response,
        expectedChallenge: consumeChallenge(ctx),
        expectedOrigin: this.passkeys.origins,
        expectedRPID: this.passkeys.id
      }).catch(err => {
        // Failed verifications are bad requests, not server errors:
        throw new AuthenticationError({ message: err.message, status: 400 })
      })
      if (verified) {
        const { credential } = registrationInfo
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
      const credentials = await getTotpQuery(this.modelClass, ctx)
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
      ctx.session.totpSetup = { secret, expires: Date.now() + timeout }
      return {
        uri: createTotp(this, ctx.state.user, secret).toString(),
        secret
      }
    },

    async 'post totp-confirm'(ctx) {
      const { user } = ctx.state
      const { secret, expires } = ctx.session.totpSetup ?? {}
      if (!(secret && expires > Date.now())) {
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
      const step = validateTotp(
        createTotp(this, user, secret),
        ctx.request.body.code
      )
      if (step !== null) {
        delete ctx.session.totpSetup
        const key = this.app.config.app.auth.credentials.secret
        const backupCodes = Array.from({ length: 10 }, () => {
          // 40 random bits, as two groups of five hex digits:
          const code = randomBytes(5).toString('hex')
          return `${code.slice(0, 5)}-${code.slice(5)}`
        })
        // Batch inserts only work on PostgreSQL:
        for (const [type, data] of [
          // The confirmed code can't be used again:
          ['totp', { secret: encrypt(key, secret), step }],
          ...backupCodes.map(code => [
            'backup-code',
            { hash: hashBackupCode(key, code) }
          ])
        ]) {
          await this.modelClass.credentialClass.query(ctx.transaction).insert({
            type,
            userModel: this.modelClass.name,
            userId: `${user.$id()}`,
            data
          })
        }
        // The backup codes are stored hashed, so users only see them now:
        return { backupCodes }
      } else {
        throw new AuthenticationError({
          message: 'Code is incorrect',
          status: 400
        })
      }
    },

    async 'delete totp'(ctx) {
      const { code } = ctx.request.body
      if (await this.verifyCode(ctx, ctx.state.user, code)) {
        await getTotpQuery(this.modelClass, ctx).delete()
        return { success: true }
      } else {
        throw new AuthenticationError({
          message: 'Code is incorrect',
          status: 400
        })
      }
    }
  }

  member = {
    authorize: ['$self']
  }

  // @override
  async setup() {
    const { session, auth } = this.app.config.app
    this.passkeys = auth?.passkeys ?? null
    this.totp = auth?.totp ?? null

    // Passkey challenges and pending logins are kept in the session, stored on
    // the server so that old cookies can't replay them, and both need
    // credentials. Their libraries are optional peer dependencies, so we only
    // import them when they are used:
    const setupAuth = (name, module) => {
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
      return import(module).catch(err => {
        throw err.code === 'ERR_MODULE_NOT_FOUND'
          ? new ControllerError(
              this,
              `Unable to use ${name} without '${module}'.`
            )
          : err
      })
    }

    if (this.passkeys) {
      const missingKey = ['name', 'id', 'origins'].find(
        key => !this.passkeys[key]
      )
      if (missingKey) {
        throw new ControllerError(
          this,
          `Invalid passkeys, missing 'app.auth.passkeys.${missingKey}'.`
        )
      }
      this.webAuthn = await setupAuth('passkeys', '@simplewebauthn/server')
    }
    if (this.totp) {
      if (!this.totp.issuer) {
        throw new ControllerError(
          this,
          `Invalid TOTP, missing 'app.auth.totp.issuer'.`
        )
      }
      this.otpAuth = await setupAuth('TOTP', 'otpauth')
      // TOTP secrets are encrypted with a secret of their own, not `app.keys`,
      // since rotating those would make them unreadable:
      if (!auth.credentials.secret) {
        throw new ControllerError(
          this,
          `Unable to use TOTP without 'app.auth.credentials.secret'.`
        )
      }
    }
    super.setup()
  }

  // @override
  processValues(values) {
    const processed = super.processValues(values)
    // Without passkeys or TOTP, we don't route their actions. Missing values,
    // e.g. the `assets` of most controllers, come back without `values`:
    if (processed.values) {
      for (const name of [
        ...(this.passkeys ? [] : passkeyActions),
        ...(this.totp ? [] : totpActions)
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

  isAuthenticated(ctx) {
    // Make sure the currently logged in user has the exact model class, since
    // sub-classes have their own tables and ids:
    return (
      ctx.isAuthenticated() &&
      ctx.state.user.constructor === this.modelClass
    )
  }

  async handleLogin(ctx, login) {
    let user
    let error
    let codeRequired = false
    try {
      user = await login()
      if (user) {
        await user.$patch({ lastLogin: new Date() }, ctx.transaction)
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

  // Verify a TOTP code, or consume a backup code of the user:
  async verifyCode(ctx, user, code) {
    const key = this.app.config.app.auth.credentials.secret
    const credentials = await getTotpQuery(this.modelClass, ctx, user)
    const totp = credentials.find(({ type }) => type === 'totp')
    if (totp && code) {
      const step = validateTotp(
        createTotp(this, user, decrypt(key, totp.data.secret)),
        code
      )
      // Each code is only accepted once:
      if (step !== null && step > totp.data.step) {
        await totp.$patch(
          { data: { ...totp.data, step }, lastUsedAt: new Date() },
          ctx.transaction
        )
        return true
      } else {
        const hash = hashBackupCode(key, code)
        const backupCode = credentials.find(
          ({ type, data }) => type === 'backup-code' && data.hash === hash
        )
        // Of concurrent requests, only one can delete the backup code:
        return (
          !!backupCode &&
          (await backupCode.$query(ctx.transaction).delete()) > 0
        )
      }
    } else {
      return false
    }
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

// Of passkey challenges and TOTP setups:
const timeout = 5 * 60 * 1000 // 5 minutes

function getPasskeyQuery(modelClass, ctx) {
  return modelClass.credentialQuery(ctx.transaction).where({
    type: 'passkey',
    userId: `${ctx.state.user.$id()}`
  })
}

function storeChallenge(ctx, { challenge }) {
  ctx.session.passkeyChallenge = {
    challenge,
    expires: Date.now() + timeout
  }
}

// Each challenge can only be answered once, before it expires:
function consumeChallenge(ctx) {
  const { challenge, expires } = ctx.session.passkeyChallenge ?? {}
  delete ctx.session.passkeyChallenge
  if (challenge && expires > Date.now()) {
    return challenge
  } else {
    throw new AuthenticationError({
      message: 'Missing or expired passkey challenge',
      status: 400
    })
  }
}

function getTotpQuery(modelClass, ctx, user = ctx.state.user) {
  return modelClass
    .credentialQuery(ctx.transaction)
    .where('userId', `${user.$id()}`)
    .whereIn('type', ['totp', 'backup-code'])
}

async function hasTotp(modelClass, ctx) {
  return !!(await getTotpQuery(modelClass, ctx).findOne({ type: 'totp' }))
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

// `app.auth.credentials.secret` is a long random string, so HKDF suffices to
// derive a key for each use:
function deriveKey(secret, use) {
  return Buffer.from(hkdfSync('sha256', secret, 'dito-credentials', use, 32))
}

// Encrypt with AES-256-GCM, with a random IV and the authentication tag stored
// before the encrypted value:
function encrypt(secret, value) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret, 'totp'), iv)
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
}

function decrypt(secret, value) {
  const buffer = Buffer.from(value, 'base64')
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(secret, 'totp'),
    buffer.subarray(0, 12)
  )
  decipher.setAuthTag(buffer.subarray(12, 28))
  return Buffer.concat([
    decipher.update(buffer.subarray(28)),
    decipher.final()
  ]).toString('utf8')
}

// Backup codes are random, so a fast hash suffices. Keyed with the secret, a
// leaked database alone doesn't allow guessing them:
function hashBackupCode(secret, code) {
  return createHmac('sha256', deriveKey(secret, 'backup-code'))
    .update(`${code}`.toLowerCase().replace(/[^0-9a-f]/g, ''))
    .digest('hex')
}
