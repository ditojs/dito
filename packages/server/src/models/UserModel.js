import bcrypt from 'bcryptjs'
import passport from 'koa-passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { Model } from './Model'
import { AuthenticationError } from '@/errors'
import { toCallback } from '@ditojs/utils'

export class UserModel extends Model {
  static properties = {
    username: {
      type: 'string',
      required: true
    },
    email: {
      type: 'string',
      format: 'email'
    },
    password: {
      type: 'string'
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

  static methods = {
    collection: {
      login: {},
      logout: {}
    }
  }

  set password(password) {
    this.hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10))
  }

  async verifyPassword(password) {
    return bcrypt.compare(password, this.hash)
  }

  static async login(ctx) {
    let user
    let error
    try {
      user = await login(this.name, ctx)
      await user.$patch({ lastLogin: new Date() })
      // Or, if we activate `change-tracking`: (but is it better?)
      // user.lastLogin = new Date()
      // await user.$store()
    } catch (err) {
      error = err.data?.message || err.message
      ctx.status = err.status || 401
    }
    const success = !!user
    return {
      success,
      authenticated: success && ctx.isAuthenticated(),
      user,
      error
    }
  }

  static async logout(ctx) {
    let success = false
    if (ctx.isAuthenticated()) {
      await ctx.logout()
      success = ctx.isUnauthenticated()
    }
    return {
      success,
      authenticated: ctx.isAuthenticated()
    }
  }

  static initialize() {
    super.initialize()
    userClasses[this.name] = this
    passport.use(this.name,
      new LocalStrategy(
        {
          usernameField: 'username',
          passwordField: 'password'
        },
        toCallback(async (username, password) => {
          const user = await this.where({ username }).first()
          return user && await user.verifyPassword(password) ? user : null
        })
      )
    )
  }
}

const userClasses = {}

passport.serializeUser(toCallback(user => {
  // To support multiple user model classes, use both the model class name and
  // id as identifier.
  const modelName = user?.constructor.name
  return userClasses[modelName] ? `${modelName}-${user.id}` : null
}))

passport.deserializeUser(toCallback(identifier => {
  const [modelName, userId] = identifier.split('-')
  return userClasses[modelName]?.findById(userId) || null
}))

async function login(name, ctx) {
  // Unfortunately koa-passport isn't promisified yet, so do some wrapping:
  return new Promise((resolve, reject) => {
    passport.authenticate(name, async (err, user, message, status) => {
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
