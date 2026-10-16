import bcrypt from 'bcryptjs'
import { mixin, asArray } from '@ditojs/utils'
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
            await ctx.login(user, options)
            return user
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
    }
)
