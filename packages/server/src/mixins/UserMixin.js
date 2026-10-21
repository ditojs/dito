import bcrypt from 'bcryptjs'
import { mixin, asArray, isString } from '@ditojs/utils'
import { AuthenticationError } from '../errors/index.js'
import {
  getPasswordFingerprint,
  getUserIdentifier
} from '../utils/authentication.js'

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

      // The model class of `app.authentication.credentials`, set up in
      // `setup()`:
      static credentialClass = null

      // The hash that the password property set, so that only updates that set
      // the password refresh the session, with the hash they wrote:
      #passwordHash = null

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
            computed: true,
            minLength: 1
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
        return verifyPassword(password, this.hash)
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

      // @override
      async $afterUpdate(opt, queryContext) {
        await super.$afterUpdate(opt, queryContext)
        // When users change their own password, we keep the session of the
        // request while their other sessions end. Instance queries patch with
        // separate models, so the user is the instance in `opt.old`:
        const hash = this.#passwordHash
        if (hash) {
          this.#passwordHash = null
          const { passport } = this.constructor.app.requestLocals.session ?? {}
          if (passport?.user === getUserIdentifier(opt.old ?? this)) {
            passport.passwordFingerprint = getPasswordFingerprint(hash)
          }
        }
      }

      // @override
      $clone(options) {
        const clone = super.$clone(options)
        // Graph saves write clones of the models that received the password:
        clone.#passwordHash = this.#passwordHash
        return clone
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
            this.hash = this.#passwordHash = bcrypt.hashSync(
              password,
              hashRounds
            )
          },

          configurable: true
        })
        const { modelClass } = (
          this.app.config.app.authentication?.credentials ?? {}
        )
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

      static async authenticate(ctx) {
        const {
          usernameProperty,
          passwordProperty
        } = this.definition.options
        const {
          [usernameProperty]: username,
          [passwordProperty]: password
        } = ctx.request.body
        if (username && password) {
          // Usernames that aren't strings are compared like unknown ones:
          const user = isString(username)
            ? await this.sessionQuery(ctx.transaction).findOne(
                usernameProperty,
                username
              )
            : null
          const isValid = user
            ? await user.$verifyPassword(password)
            : await verifyPassword(password, null)
          if (isValid) {
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

      static credentialQuery(trx) {
        return this.credentialClass.query(trx).where('userModel', this.name)
      }
    }
)

// The cost of the password hashes, also of the dummy one:
const hashRounds = 10
let dummyHash = null

// Compare against a dummy hash for unknown users and users without a password,
// e.g. invited ones, so that the time of the answer doesn't tell which
// usernames exist. Passwords that aren't strings are just wrong:
async function verifyPassword(password, hash) {
  dummyHash ??= await bcrypt.hash('', hashRounds)
  return (
    isString(password) &&
    (await bcrypt.compare(password, hash || dummyHash)) &&
    !!hash
  )
}
