import bcrypt from 'bcryptjs'
import passport from 'koa-passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { AuthenticationError } from '@/errors'
import { toCallback } from '@ditojs/utils'

export const UserMixin = Model => class extends Model {
  static options = {
    usernameProperty: 'username',
    passwordProperty: 'password'
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

  set password(password) {
    this.hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10))
  }

  async $verifyPassword(password) {
    return bcrypt.compare(password, this.hash)
  }

  $hasRole(...roles) {
    // Support an optional `roles` arry on the model that can contain roles.
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
          passwordField: passwordProperty
        },
        toCallback(async (username, password) => {
          const user = await this.where(usernameProperty, username).first()
          return user && await user.$verifyPassword(password) ? user : null
        })
      )
    )
  }

  static async login(ctx) {
    // Unfortunately koa-passport isn't promisified yet, so do some wrapping:
    return new Promise((resolve, reject) => {
      // Use a custom callback to handle authentication, see:
      // http://www.passportjs.org/docs/downloads/html/#custom-callback
      passport.authenticate(this.name, async (err, user, message, status) => {
        if (err) {
          reject(err)
        } else if (user) {
          try {
            await ctx.login(user)
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
}

const userClasses = {}

passport.serializeUser(toCallback(user => {
  // To support multiple user model classes, use both the model class name and
  // id as identifier.
  const modelName = user?.constructor.name
  return userClasses[modelName] ? `${modelName}-${user.id}` : null
}))

passport.deserializeUser(toCallback(async identifier => {
  const [modelName, userId] = identifier.split('-')
  return await userClasses[modelName]?.findById(userId) || null
}))
