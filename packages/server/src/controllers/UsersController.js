import Keygrip from 'keygrip'
import { asArray, isArray, isString } from '@ditojs/utils'
import { ModelController } from './ModelController.js'
import { PasskeyService, TotpService } from '../services/index.js'
import {
  authenticationTimeout,
  getCredentialQuery,
  getUserIdentifier,
  parseUserIdentifier
} from '../utils/authentication.js'
import { checkDuration } from '../utils/duration.js'
import {
  AuthenticationError,
  AuthorizationError,
  ControllerError,
  NotFoundError,
  ResponseError,
  ValidationError
} from '../errors/index.js'

export class UsersController extends ModelController {
  // The names of the actions of each feature, e.g. to list them in `allow`:
  static actionNames = {
    // Only routed with `PasskeyService`:
    passkeys: [
      'post passkey-login-options',
      'post passkey-login',
      'get passkeys',
      'post passkey-options',
      'post passkeys',
      'delete passkeys/:id'
    ],

    // Only routed with `TotpService`:
    totp: [
      'post login-code',
      'get totp',
      'post totp',
      'post totp-confirm',
      'delete totp'
    ],

    // Only routed with `app.authentication.passwordReset`, as apps send the
    // emails:
    passwordReset: [
      'post password-reset',
      'post password-reset-confirm'
    ]
  }

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
      // Users manage their own password, passkeys and TOTP, which the handlers
      // check:
      'post confirm-access': true,
      'post password': true,
      'get passkeys': true,
      'post passkey-options': true,
      'post passkeys': true,
      'delete passkeys/:id': true,
      'get totp': true,
      'post totp': true,
      'post totp-confirm': true,
      'delete totp': true
    },

    'post login'(ctx) {
      return handleLogin(this, ctx, async () => {
        const user = await this.modelClass.authenticate(ctx)
        if (await hasTotp(ctx, user)) {
          checkTotpService(this, ctx, 'Password or username is incorrect')
          // Users with TOTP are only logged in once they enter a code, through
          // 'post login-code'. Like `ctx.login()`, regenerate the session id
          // against session fixation:
          ctx.session.pendingLogin = {
            user: getUserIdentifier(user),
            expires: Date.now() + authenticationTimeout
          }
          await ctx.session.regenerate()
          return { codeRequired: true }
        } else {
          return { user }
        }
      })
    },

    // The second step of password logins of users with TOTP, with a TOTP code
    // or a backup code:
    'post login-code'(ctx) {
      return handleLogin(this, ctx, async () => {
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
          if (user) {
            await this.totp.verifyCode(ctx, user, ctx.request.body.code)
            delete ctx.session.pendingLogin
            return { user }
          } else {
            throw new AuthenticationError('Code is incorrect')
          }
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
      // transacted, to keep their failures:
      transacted: false,

      parameters: {
        password: { type: 'string' },
        code: { type: 'string' },
        passkey: { type: 'object' }
      },

      async handler(ctx, { password, code, passkey }) {
        checkAuthentication(this, ctx)
        const { user } = ctx.state
        if (this.passkeys && passkey) {
          // The passkeys of other users verify too, but don't confirm:
          if (!(await verifyPasskey(this, ctx, passkey)).$is(user)) {
            throw new AuthenticationError('Passkey is incorrect')
          }
        } else if (!(password && (await user.$verifyPassword(password)))) {
          throw new AuthenticationError('Password is incorrect')
        } else if (await hasTotp(ctx, user)) {
          checkTotpService(this, ctx, 'Password is incorrect')
          // Like password logins, ask users with TOTP for a code:
          if (code) {
            await this.totp.verifyCode(ctx, user, code)
          } else {
            return { success: false, codeRequired: true }
          }
        }
        storeConfirmedAccess(this, ctx, user)
        return { success: true }
      }
    },

    // Let users change their password without routing `patch`, which would let
    // them change all their properties:
    'post password': {
      parameters: {
        password: { type: 'string', required: true }
      },

      async handler(ctx, { password }) {
        this.checkConfirmedAccess(ctx)
        const { user } = ctx.state
        const { passwordProperty } = this.modelClass.definition.options
        // The password property validates the password and sets its hash:
        await user
          .$query(ctx.transaction)
          .patch({ [passwordProperty]: password })
        return { success: true }
      }
    },

    // Answer the same whether the user exists or not, to not tell which
    // usernames exist:
    async 'post password-reset'(ctx) {
      const { modelClass } = this
      const { usernameProperty } = modelClass.definition.options
      const username = ctx.request.body[usernameProperty]
      if (!username || !isString(username)) {
        throw new ResponseError({
          message: `${username ? 'Invalid' : 'Missing'} '${usernameProperty}'`,
          status: 400
        })
      }
      const user = await modelClass
        .sessionQuery(ctx.transaction)
        .findOne(usernameProperty, username)
      if (user) {
        const token = createPasswordResetToken(this, user, Date.now())
        const url = this.passwordReset.confirmUrl.replace('{token}', token)
        // Don't wait for the email: its failures don't change the answer, also
        // when `sendPasswordReset()` throws right away:
        Promise.try(() => this.sendPasswordReset(ctx, user, url)).catch(err =>
          this.app.emit('error', err, ctx)
        )
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

    'post passkey-login-options'(ctx) {
      return this.passkeys.createAuthenticationOptions(ctx)
    },

    'post passkey-login'(ctx) {
      return handleLogin(this, ctx, async () => ({
        user: await verifyPasskey(this, ctx, ctx.request.body)
      }))
    },

    'get passkeys'(ctx) {
      checkAuthentication(this, ctx)
      return getCredentialQuery(
        ctx.state.user,
        'passkey',
        ctx.transaction
      ).select(
        'id',
        'name',
        'createdAt',
        'lastUsedAt'
      )
    },

    async 'post passkey-options'(ctx) {
      this.checkConfirmedAccess(ctx)
      const { user } = ctx.state
      return this.passkeys.createRegistrationOptions(
        ctx,
        user,
        await getCredentialQuery(user, 'passkey', ctx.transaction)
      )
    },

    'post passkeys': {
      transacted: false, // It consumes the challenge.

      async handler(ctx) {
        this.checkConfirmedAccess(ctx)
        const { id, name, createdAt } = await this.passkeys.verifyRegistration(
          ctx,
          ctx.state.user,
          ctx.request.body
        )
        return { id, name, createdAt, lastUsedAt: null }
      }
    },

    async 'delete passkeys/:id'(ctx) {
      this.checkConfirmedAccess(ctx)
      const count = await getCredentialQuery(
        ctx.state.user,
        'passkey',
        ctx.transaction
      ).deleteById(ctx.params.id)
      if (count > 0) {
        return { success: true }
      } else {
        throw new NotFoundError()
      }
    },

    async 'get totp'(ctx) {
      checkAuthentication(this, ctx)
      const totp = await getCredentialQuery(
        ctx.state.user,
        'totp',
        ctx.transaction
      ).first()
      return {
        enabled: !!totp,
        backupCodes: totp?.data.backupCodes.length ?? 0
      }
    },

    async 'post totp'(ctx) {
      this.checkConfirmedAccess(ctx)
      const { user } = ctx.state
      if (await hasTotp(ctx, user)) {
        throw new ResponseError({
          message: 'TOTP is already set up',
          status: 409
        })
      }
      return this.totp.createSecret(ctx, user)
    },

    async 'post totp-confirm'(ctx) {
      this.checkConfirmedAccess(ctx)
      const backupCodes = await this.totp.confirmSecret(
        ctx,
        ctx.state.user,
        ctx.request.body.code
      )
      // The backup codes are stored hashed, so users only see them now:
      return { backupCodes }
    },

    async 'delete totp'(ctx) {
      this.checkConfirmedAccess(ctx)
      await getCredentialQuery(ctx.state.user, 'totp', ctx.transaction).delete()
      return { success: true }
    }
  }

  member = {
    authorize: ['$self']
  }

  // @override
  setup() {
    const { app } = this
    const { session, authentication } = app.config.app
    // Users log in through sessions, which also keep their confirmed access:
    if (!session) {
      throw new ControllerError(
        this,
        `Unable to log in users without sessions, see 'app.session'.`
      )
    }
    // Apps use passkeys and TOTP by registering their services:
    this.passkeys = app.findService(
      service => service instanceof PasskeyService
    )
    this.totp = app.findService(service => service instanceof TotpService)
    this.reconfirmAccessAfter = checkDuration(
      'app.authentication.reconfirmAccessAfter',
      authentication?.reconfirmAccessAfter ?? '10m',
      { min: 1, usage: 'Use a duration above 0.' }
    )
    this.passwordReset = authentication?.passwordReset
      ? {
          ...authentication.passwordReset,
          expiresAfter: checkDuration(
            'app.authentication.passwordReset.expiresAfter',
            authentication.passwordReset.expiresAfter ?? '1h',
            { min: 1, usage: 'Use a duration above 0.' }
          ),
          // Sign the links like Koa signs cookies, with the first of `app.keys`
          // while accepting all of them, to rotate keys:
          keys: isArray(app.keys) ? new Keygrip(app.keys, 'sha256') : app.keys
        }
      : null

    // Passkey challenges and pending logins are kept in the session, stored on
    // the server against replays with old cookies, and both need credentials:
    const checkCredentials = name => {
      if (!(session.modelClass || session.store || session.ContextStore)) {
        throw new ControllerError(
          this,
          `Unable to use ${name} without sessions stored on the server, ` +
          `see 'app.session'.`
        )
      }
      if (!this.modelClass.credentialClass) {
        throw new ControllerError(
          this,
          `Unable to use ${name} without credentials, see ` +
          `'app.authentication.credentials'.`
        )
      }
    }

    if (this.passkeys) {
      checkCredentials('passkeys')
    }
    if (this.totp) {
      checkCredentials('TOTP')
    }
    if (this.passwordReset) {
      if (!this.passwordReset.confirmUrl?.includes('{token}')) {
        throw new ControllerError(
          this,
          `Invalid password reset, ` +
          `'app.authentication.passwordReset.confirmUrl' needs a '{token}' ` +
          `placeholder.`
        )
      }
      if (!this.passwordReset.keys) {
        throw new ControllerError(
          this,
          `Unable to use password reset without 'app.keys'.`
        )
      }
    }
    super.setup()
    // Actions that need confirmed access are only routed together with the
    // action that confirms it, after `allow` and `processValues()`:
    if (!this.collection['post confirm-access']) {
      const name = [
        ...confirmedAccessActionNames,
        // Relating users with ids updates them:
        ...(this.relate ? ['post'] : [])
      ].find(action => this.collection[action] || this.member[action])
      if (name) {
        throw new ControllerError(
          this,
          `Unable to route '${name}' without 'post confirm-access', which ` +
          `confirms the access it needs.`
        )
      }
    }
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
  }

  // @override
  processValues(values) {
    const processed = super.processValues(values)
    // Without the services of passkeys and TOTP or without password reset, we
    // don't route their actions, which are all in `collection`:
    if (values === this.collection) {
      const { actionNames } = UsersController
      for (const name of [
        ...(this.passkeys ? [] : actionNames.passkeys),
        ...(this.totp ? [] : actionNames.totp),
        ...(this.passwordReset ? [] : actionNames.passwordReset)
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
    await checkUserChanges(
      this,
      ctx,
      action,
      asArray(body).map(user => [this.getModelId(user), user])
    )
    return super.executeAndFetch(action, ctx, modify, body)
  }

  // @override
  async relateAndFetch(ctx, modify) {
    await checkUserChanges(
      this,
      ctx,
      'relate',
      asArray(ctx.request.body).map(user => [this.getModelId(user), user])
    )
    return super.relateAndFetch(ctx, modify)
  }

  // @override
  async executeAndFetchById(action, ctx, modify, body = ctx.request.body) {
    await checkUserChanges(this, ctx, action, [[ctx.memberId, body]])
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
  // `app.authentication.reconfirmAccessAfter`:
  hasConfirmedAccess(ctx) {
    const { user, expires } = ctx.session.confirmedAccess ?? {}
    return (
      this.isAuthenticated(ctx) &&
      user === getUserIdentifier(ctx.state.user) &&
      expires > Date.now()
    )
  }

  // Without a login, we answer 401. Without confirmed access, we answer 403
  // with `confirmationRequired`, for clients to confirm it:
  checkConfirmedAccess(ctx) {
    checkAuthentication(this, ctx)
    if (!this.hasConfirmedAccess(ctx)) {
      throw new AuthorizationError({
        message: 'Confirmation required',
        status: 403,
        confirmationRequired: true
      })
    }
  }

  // The admin offers the features whose actions we route, all of them:
  getAuthenticationFeatures() {
    const isRouted = names => names.every(name => this.collection[name])
    const { actionNames } = UsersController
    return {
      hasPasskeys: isRouted(actionNames.passkeys),
      hasTotp: isRouted(actionNames.totp),
      hasPasswordChange: isRouted(['post password']),
      hasPasswordReset: isRouted(actionNames.passwordReset)
    }
  }

  // Send the user the email with the `url` that resets their password, with
  // `app.authentication.passwordReset`. It runs after the answer, with `ctx`
  // only to read the request:
  // @overridable
  async sendPasswordReset(/* ctx, user, url */) {
    // To be overridden in sub-classes that route 'post password-reset'.
  }

  // Password reset links only work while these values of the user stay the
  // same: a login, a password change or a username change invalidates them:
  // @overridable
  getPasswordResetTokenValues(user) {
    const { usernameProperty } = this.modelClass.definition.options
    return [user.hash, user.lastLogin, user[usernameProperty]]
  }
}

// Only routed with 'post confirm-access', for password and username changes
// and the security actions:
const confirmedAccessActionNames = [
  'patch',
  'put',
  'post password',
  'post passkey-options',
  'post passkeys',
  'delete passkeys/:id',
  'post totp',
  'post totp-confirm',
  'delete totp'
]

// Log in the user of `authenticate()`, unless it requires a code first:
async function handleLogin(controller, ctx, authenticate) {
  try {
    const { user, codeRequired } = await authenticate()
    if (codeRequired) {
      return { success: false, codeRequired, authenticated: false, user: null }
    } else {
      await ctx.login(user)
      await user.$patch({ lastLogin: new Date() }, ctx.transaction)
      storeConfirmedAccess(controller, ctx, user)
      return {
        success: true,
        authenticated: controller.isAuthenticated(ctx),
        user
      }
    }
  } catch (err) {
    // Answer rejected logins, and leave other errors to `handleError()`, which
    // hides their internal messages:
    if (err instanceof ResponseError && err.status < 500) {
      controller.app.emit('error', err, ctx)
      ctx.status = err.status
      return {
        success: false,
        authenticated: false,
        user: null,
        error: err.data?.message || err.message
      }
    } else {
      throw err
    }
  }
}

// The handlers check the login and the confirmed access themselves, which no
// `authorize` setting can drop. Without a login of a user of the controller, we
// answer 401:
function checkAuthentication(controller, ctx) {
  if (!controller.isAuthenticated(ctx)) {
    throw new AuthorizationError()
  }
}

// Resolve to the user of the passkey that answered the challenge in the
// session:
async function verifyPasskey(controller, ctx, response) {
  const { modelClass, passkeys } = controller
  const credential = await modelClass
    .credentialQuery(ctx.transaction)
    .findOne({ type: 'passkey', key: response.id ?? null })
  const user = credential
    ? await modelClass.sessionQuery(ctx.transaction).findById(credential.userId)
    : null
  // The passkeys of users excluded by the session scope stay unused:
  await passkeys.verifyAuthentication(ctx, user && credential, response)
  return user
}

async function hasTotp(ctx, user) {
  return (
    !!user.constructor.credentialClass &&
    !!(await getCredentialQuery(user, 'totp', ctx.transaction).first())
  )
}

// Users with TOTP always need a code, also when the app no longer registers
// `TotpService`. Then we report it, and answer with the `message` of wrong
// passwords, which doesn't tell that the password was right:
function checkTotpService(controller, ctx, message) {
  if (!controller.totp) {
    controller.app.emit(
      'error',
      new ControllerError(
        controller,
        `Unable to authenticate users with TOTP without 'TotpService'.`
      ),
      ctx
    )
    throw new AuthenticationError(message)
  }
}

// Setting passwords and changing usernames needs confirmed access, the latter
// as password resets go to them. `UserMixin` rejects hashes in all input.
// `users` are `[id, user]` entries:
async function checkUserChanges(controller, ctx, action, users) {
  const { modelClass } = controller
  const { usernameProperty, passwordProperty } = modelClass.definition.options
  for (const [id, user] of users) {
    // Relating users with ids updates them:
    const isUpdate = action !== 'insert' && (action !== 'relate' || id != null)
    if (isUpdate) {
      if (user?.[passwordProperty] !== undefined) {
        controller.checkConfirmedAccess(ctx)
      }
      const username = user?.[usernameProperty]
      if (username !== undefined) {
        const stored = await modelClass.query(ctx.transaction).findById(id)
        if (stored?.[usernameProperty] !== username) {
          controller.checkConfirmedAccess(ctx)
        }
      }
    }
  }
}

function storeConfirmedAccess(controller, ctx, user) {
  ctx.session.confirmedAccess = {
    user: getUserIdentifier(user),
    expires: Date.now() + controller.reconfirmAccessAfter
  }
}

// Tokens carry the user's id and their creation time, with a signature that
// also covers the values of the user. Nothing is stored:
function createPasswordResetToken(controller, user, time) {
  const id = Buffer.from(`${user.$id()}`).toString('base64url')
  const signature = controller.passwordReset.keys.sign(
    getPasswordResetData(controller, user, time)
  )
  return `${id}.${time.toString(36)}.${signature}`
}

// Find the user of a token that hasn't expired and is signed with one of
// `app.keys`:
async function findPasswordResetUser(controller, ctx, token) {
  const { keys, expiresAfter } = controller.passwordReset
  const match = token.match(/^([\w-]*)\.([\da-z]+)\.([\w-]+)$/)
  const [, encodedId, encodedTime, signature] = match ?? []
  const time = parseInt(encodedTime, 36)
  if (match && Date.now() - time < expiresAfter) {
    try {
      const id = Buffer.from(encodedId, 'base64url').toString()
      const user = await controller.modelClass
        .sessionQuery(ctx.transaction)
        .findById(controller.validateId(id))
      const isValid = (
        user &&
        keys.verify(getPasswordResetData(controller, user, time), signature)
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

// Dates count as ISO strings, missing values as `null`:
function getPasswordResetData(controller, user, time) {
  return JSON.stringify([
    getUserIdentifier(user),
    time,
    ...controller.getPasswordResetTokenValues(user)
  ])
}
