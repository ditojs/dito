import bcrypt from 'bcryptjs'
import { mixin, asArray, isString } from '@ditojs/utils'
import { AuthenticationError } from '../errors/index.js'

export const UserMixin = mixin(
  Model =>
    class extends Model {
      static options = {
        usernameProperty: 'username',
        passwordProperty: 'password',
        // This option can be used to specify (eager) scopes to be applied when
        // the user is deserialized from the session.
        sessionScope: undefined
      }

      // The model class of `app.auth.credentials`, set up in `setup()`:
      static credentialClass = null

      static get properties() {
        const {
          usernameProperty,
          passwordProperty
        } = this.definition.options
        return {
          [usernameProperty]: {
            type: 'string',
            required: true
          },

          // `password` isn't stored, but this is required for validation:
          [passwordProperty]: {
            type: 'string',
            computed: true
          },

          hash: {
            type: 'string',
            hidden: true
          },

          lastLogin: {
            type: 'timestamp',
            nullable: true
          }
        }
      }

      static hooks = {
        // Credentials refer to their users without foreign keys, so we delete
        // them along with their users:
        async 'before:delete'({ asFindQuery, transaction }) {
          if (this.credentialClass) {
            const users = await asFindQuery().select(
              this.getIdPropertyArray()
            )
            const userIds = users.map(user => `${user.$id()}`)
            await this.credentialQuery(transaction)
              .whereIn('userId', userIds)
              .delete()
          }
        }
      }

      async $verifyPassword(password) {
        // Users without a password, e.g. invited ones, can't log in:
        return this.hash ? bcrypt.compare(password, this.hash) : false
      }

      $hasRole(...roles) {
        // Support an optional `roles` array on the model that can contain roles
        return this.roles?.find(role => roles.includes(role)) || false
      }

      $hasOwner(owner) {
        return this.$is(owner)
      }

      $isLoggedIn(ctx) {
        return this.$is(ctx.state.user)
      }

      static setup() {
        super.setup()
        const { passwordProperty } = this.definition.options
        Object.defineProperty(this.prototype, passwordProperty, {
          get() {
            // Nice try ;)
            return undefined
          },

          set(password) {
            this.hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10))
          },

          configurable: true
        })
        const { modelClass } = this.app.config.app.auth?.credentials ?? {}
        if (modelClass) {
          this.credentialClass = isString(modelClass)
            ? this.app.models[modelClass]
            : modelClass
          if (!this.credentialClass) {
            throw new Error(
              `Unable to find credential model class: '${modelClass}'.`
            )
          }
        }
      }

      static async login(ctx, options) {
        const {
          usernameProperty,
          passwordProperty
        } = this.definition.options
        const {
          [usernameProperty]: username,
          [passwordProperty]: password
        } = ctx.request.body
        if (username && password) {
          const user = await this.sessionQuery(ctx.transaction).findOne(
            usernameProperty,
            username
          )
          if (user && (await user.$verifyPassword(password))) {
            const totp = this.app.config.app.auth?.totp
              ? await this.credentialQuery(ctx.transaction).findOne({
                  type: 'totp',
                  userId: `${user.$id()}`
                })
              : null
            if (totp) {
              // Users with TOTP are only logged in once they enter a code,
              // through `'post login-code'` of `UsersController`. Until then,
              // there is no user to return:
              ctx.session.pendingLogin = {
                user: `${this.name}-${user.$id()}`,
                expires: Date.now() + 5 * 60 * 1000, // 5 minutes
                attempts: 5
              }
              return null
            } else {
              await ctx.login(user, options)
              return user
            }
          } else {
            throw new AuthenticationError('Password or username is incorrect')
          }
        } else {
          throw new AuthenticationError({
            message: 'Missing credentials',
            status: 400
          })
        }
      }

      static sessionQuery(trx) {
        return this.query(trx).withScope(
          ...asArray(this.definition.options.sessionScope)
        )
      }

      static credentialQuery(trx) {
        if (this.credentialClass) {
          return this.credentialClass.query(trx).where('userModel', this.name)
        } else {
          throw new Error(
            `Unable to query credentials without 'app.auth.credentials'.`
          )
        }
      }
    }
)
