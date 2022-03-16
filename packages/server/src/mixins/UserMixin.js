import bcrypt from 'bcryptjs'
import passport from 'koa-passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { mixin, asArray } from '@ditojs/utils'
import { AuthenticationError } from '../errors/index.js'

export const UserMixin = mixin(Model => class extends Model {
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

  get password() {
    // Nice try ;)
    return undefined
  }

  set password(password) {
    this.hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10))
  }

  async $verifyPassword(password) {
    return bcrypt.compare(password, this.hash)
  }

  $hasRole(...roles) {
    // Support an optional `roles` array on the model that can contain roles.
    return this.roles?.find(role => roles.includes(role)) || false
  }

  $hasOwner(owner) {
    return this.$is(owner)
  }

  $isLoggedIn(ctx) {
    return this.$is(ctx.state.user)
  }

  static initialize() {
    super.initialize()
    userClasses[this.name] = this
    const {
      usernameProperty,
      passwordProperty
    } = this.definition.options
    passport.use(this.name,
      new LocalStrategy(
        {
          usernameField: usernameProperty,
          passwordField: passwordProperty,
          // Wee need the `req` object, so we can get the active database
          // transaction through `req.ctx.transaction`:
          passReqToCallback: true
        },
        async (req, username, password, done) => {
          try {
            const user = await this.sessionQuery(req.ctx.transaction)
              .findOne(usernameProperty, username)
            const res = user && await user.$verifyPassword(password)
              ? user
              : null
            done(null, res)
          } catch (err) {
            done(err)
          }
        }
      )
    )
  }

  static async login(ctx, options) {
    // Unfortunately koa-passport isn't promisified yet, so do some wrapping:
    return new Promise((resolve, reject) => {
      // Use a custom callback to handle authentication, see:
      // http://www.passportjs.org/docs/downloads/html/#custom-callback
      passport.authenticate(this.name, async (err, user, message, status) => {
        if (err) {
          reject(err)
        } else if (user) {
          try {
            await ctx.login(user, options)
            resolve(user)
          } catch (err) {
            reject(err)
          }
        } else {
          reject(new AuthenticationError(
            message || 'Password or username is incorrect', status))
        }
      })(ctx)
    })
  }

  static sessionQuery(trx) {
    return this.query(trx).withScope(
      ...asArray(this.definition.options.sessionScope)
    )
  }
})

const userClasses = {}

// NOTE: We can't use toCallback() here since passport checks function arity to
// determine sequence of arguments received, and `req` would not be included:
passport.serializeUser((req, user, done) => {
  // To support multiple user model classes, use both the model class name and
  // id as identifier.
  const modelName = user?.constructor.name
  const identifier = modelName && userClasses[modelName]
    ? `${modelName}-${user.id}`
    : null
  done(null, identifier)
})

passport.deserializeUser(async (req, identifier, done) => {
  const [modelName, userId] = identifier.split('-')
  const userClass = userClasses[modelName]
  try {
    const user = userClass
      ? await userClass.sessionQuery(req.ctx.transaction).findById(userId)
      : null
    done(null, user)
  } catch (err) {
    done(err)
  }
})
