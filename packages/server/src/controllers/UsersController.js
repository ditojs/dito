import { ModelController } from './ModelController.js'
import {
  AuthenticationError,
  AuthorizationError,
  ControllerError,
  NotFoundError
} from '../errors/index.js'

export class UsersController extends ModelController {
  collection = {
    // These actions authenticate users, so the controller's `authorize`
    // setting doesn't apply to them:
    'authorize': {
      'post login': true,
      'post logout': true,
      'get session': true,
      'post passkey-login-options': true,
      'post passkey-login': true,
      // Users manage their own passkeys:
      'get passkeys': ctx => this.isAuthenticated(ctx),
      'post passkey-options': ctx => this.isAuthenticated(ctx),
      'post passkeys': ctx => this.isAuthenticated(ctx),
      'delete passkeys/:id': ctx => this.isAuthenticated(ctx)
    },

    'post login'(ctx) {
      return this.handleLogin(ctx, () => this.modelClass.login(ctx))
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
    }
  }

  member = {
    authorize: ['$self']
  }

  // @override
  async setup() {
    const { session, auth } = this.app.config.app
    this.passkeys = auth?.passkeys ?? null
    if (this.passkeys) {
      const missingKey = ['name', 'id', 'origins'].find(
        key => !this.passkeys[key]
      )
      // Passkey challenges are kept in the session, stored on the server so
      // that old cookies can't replay them, and passkeys are credentials:
      if (!(session?.modelClass || session?.store || session?.ContextStore)) {
        throw new ControllerError(
          this,
          `Unable to use passkeys without sessions stored on the server, ` +
          `see 'app.session'.`
        )
      } else if (!this.modelClass.credentialClass) {
        throw new ControllerError(
          this,
          `Unable to use passkeys without credentials, see ` +
          `'app.auth.credentials'.`
        )
      } else if (missingKey) {
        throw new ControllerError(
          this,
          `Invalid passkeys, missing 'app.auth.passkeys.${missingKey}'.`
        )
      }
      // `@simplewebauthn/server` is an optional peer dependency, so we only
      // import it when passkeys are used:
      this.webAuthn = await import('@simplewebauthn/server').catch(err => {
        throw err.code === 'ERR_MODULE_NOT_FOUND'
          ? new ControllerError(
              this,
              `Unable to use passkeys without '@simplewebauthn/server'.`
            )
          : err
      })
    }
    super.setup()
  }

  // @override
  processValues(values) {
    const processed = super.processValues(values)
    // Without passkeys, we don't route their actions. Missing values, e.g. the
    // `assets` of most controllers, come back without `values`:
    if (!this.passkeys && processed.values) {
      for (const name of passkeyActions) {
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
    try {
      user = await login()
      await user.$patch({ lastLogin: new Date() }, ctx.transaction)
    } catch (err) {
      this.app.emit('error', err, ctx)
      user = null
      error = err.data?.message || err.message
      ctx.status = err.status || 401
    }
    const success = !!user
    return {
      success,
      authenticated: success && this.isAuthenticated(ctx),
      user,
      error
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

const challengeTimeout = 5 * 60 * 1000 // 5 minutes

function getPasskeyQuery(modelClass, ctx) {
  return modelClass.credentialQuery(ctx.transaction).where({
    type: 'passkey',
    userId: `${ctx.state.user.$id()}`
  })
}

function storeChallenge(ctx, { challenge }) {
  ctx.session.passkeyChallenge = {
    challenge,
    expires: Date.now() + challengeTimeout
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
