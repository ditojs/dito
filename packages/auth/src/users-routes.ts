import type { Context } from 'hono'
import { z } from 'zod'
import { isPlainObject, isString } from '@ditojs/utils'
import {
  bodyValidation,
  createValidationError,
  defineAction,
  defineMixin,
  HttpError,
  type Actions,
  type ControllerDefinition,
  type Handler
} from '@ditojs/server'
import {
  authError,
  authenticationTimeout,
  getUserIdentifier,
  parseUserIdentifier
} from './authentication.ts'
import type { Credentials } from './credentials.ts'
import type { passkeys } from './passkeys.ts'
import type { passwordReset } from './password-reset.ts'
import { hashPassword, verifyPassword } from './passwords.ts'
import { getSession } from './sessions.ts'
import type { totp } from './totp.ts'
import type { User, UserSource } from './types.ts'

// The login, session and security actions of the admin, which need the
// middleware of `createSessions()`. Each handler checks the login and the
// confirmed access it needs itself, so the controller sets `authorize: true`.
// It also sets `transacted: false`, as TOTP opens a transaction of its own, so
// that failed codes stay counted when the request fails. The app adds CSRF
// protection.

export interface UsersRoutesOptions<U extends User> {
  // The path of the users under the API's prefix, such as `admins`.
  path: string
  source: UserSource<U>
  // Needed for passkeys and TOTP.
  credentials?: Credentials
  features?: {
    // From `@ditojs/auth/passkeys` and `@ditojs/auth/totp`.
    passkeys?: ReturnType<typeof passkeys>
    totp?: ReturnType<typeof totp>
    passwordReset?: ReturnType<typeof passwordReset>
  }
  // The schema of new passwords, at least 8 characters by default.
  password?: z.ZodType<string>
  // In milliseconds, ten minutes by default.
  reconfirmAfter?: number
  afterLogin?: (c: Context, user: U) => unknown
}

const anyBody = z.record(z.string(), z.unknown())
// The ids of the `credential` table.
const credentialId = z.coerce
  .number()
  .int()
  .min(1)
  .max(2 ** 31 - 1)
const required = (name: string) => {
  const error = `The ${name} is required.`
  return z.string({ error }).min(1, error)
}
const defaultPassword = z
  .string({ error: 'The password is required.' })
  .min(8, 'The password needs at least 8 characters.')

// Returns the controller of the actions, which the app passes to `createApi()`,
// or puts in the `mixins` of a controller of its own, and the `features` that
// tell the admin what to offer, as `dito.authentication`. A model controller
// doesn't fit, as it would flush and serialize the answers of the actions.
export function usersRoutes<U extends User>({
  path,
  source,
  credentials,
  features: { passkeys, totp, passwordReset } = {},
  password = defaultPassword,
  reconfirmAfter = 10 * 60 * 1000,
  afterLogin
}: UsersRoutesOptions<U>) {
  if ((passkeys || totp) && !credentials) {
    throw new Error('Unable to use passkeys or TOTP without credentials.')
  }
  const checkAuthentication = async (c: Context) => {
    const user = await getSession(c).getUser(source)
    if (!user) throw authError('Unauthorized Access')
    return user
  }

  const checkConfirmedAccess = (c: Context) =>
    getSession(c).checkConfirmedAccess(source)

  const hasTotp = async (c: Context, user: U) => (
    !!credentials && !!(await credentials.first(source, user, 'totp'))
  )

  // Users with TOTP always need a code, even when the app doesn't use TOTP.
  // They then get the error of a wrong password, which doesn't reveal that the
  // password was right.
  const checkTotpService = (message: string) => {
    if (!totp) throw authError(message)
    return totp
  }

  const login = async (c: Context, user: U) => {
    const session = getSession(c)
    session.login(source, user)
    await source.patch(c, user, { lastLogin: new Date() })
    session.confirmAccess(source, user, reconfirmAfter)
    await afterLogin?.(c, user)
    return { user: await source.toJSON(c, user) }
  }

  // Returns the user of the passkey that signed the challenge in the session.
  const verifyPasskey = async (c: Context, response: any) => {
    const key = response?.id
    const credential = isString(key)
      ? await credentials!.findByKey(source, 'passkey', key)
      : null
    const user = credential
      ? await source.findById(c, credential.userId)
      : null
    await passkeys!.verifyAuthentication(
      c,
      credentials!,
      user ? credential : null,
      response
    )
    return user!
  }

  const setPassword = async (c: Context, user: U, password: string) => {
    await source.patch(c, user, { hash: await hashPassword(password) })
    getSession(c).refreshFingerprint(source, user)
  }

  const actions: Actions = {
    'post login': defineAction({
      body: anyBody,
      handler: async ({ body: { username, password }, c }) => {
        if (!username || !password) {
          throw authError('Missing credentials', 400)
        }
        // Usernames that aren't strings are compared like unknown ones.
        const user = isString(username)
          ? await source.findByUsername(c, username)
          : null
        if (!((await verifyPassword(password, user?.hash)) && user)) {
          throw authError('Password or username is incorrect')
        }
        if (await hasTotp(c, user)) {
          checkTotpService('Password or username is incorrect')
          // The login completes with a code, through `POST login-code`.
          const session = getSession(c)
          session.value.pendingLogin = {
            user: getUserIdentifier(source, user),
            expires: Date.now() + authenticationTimeout
          }
          session.regenerate()
          return { codeRequired: true }
        }
        return login(c, user)
      }
    }),

    'post logout': ({ c }) => {
      getSession(c).logout()
    },

    // The logged-in user, or null.
    'get self': async ({ c }) => {
      const user = await getSession(c).getUser(source)
      return user ? source.toJSON(c, user) : null
    },

    // Confirms the access of the logged-in user with the password, and the
    // code of users with TOTP, or with a passkey.
    'post confirm-access': defineAction({
      body: anyBody,
      handler: async ({ body: { password, code, passkey }, c }) => {
        const user = await checkAuthentication(c)
        if (passkeys && passkey) {
          // The passkeys of other users verify too, but don't confirm.
          const passkeyUser = await verifyPasskey(c, passkey)
          if (
            getUserIdentifier(source, passkeyUser) !==
            getUserIdentifier(source, user)
          ) {
            throw authError('Passkey is incorrect')
          }
        } else if (!(await verifyPassword(password, user.hash))) {
          throw authError('Password is incorrect')
        } else if (await hasTotp(c, user)) {
          const feature = checkTotpService('Password is incorrect')
          if (!code) return { codeRequired: true }
          await feature.verifyCode(credentials!, source, user, code)
        }
        getSession(c).confirmAccess(source, user, reconfirmAfter)
      }
    }),

    'post password': defineAction({
      body: z.object({ password }),
      handler: async ({ body, c }) => {
        const user = await checkConfirmedAccess(c)
        await setPassword(c, user, body.password)
      }
    }),

    ...(passwordReset && {
      // Responds the same way whether the user exists or not, so that the
      // response doesn't reveal which usernames exist.
      'post password-reset': defineAction({
        body: z.object({ username: required('username') }),
        handler: async ({ body: { username }, c }) => {
          const user = await source.findByUsername(c, username)
          if (user) passwordReset.request(c, source, user)
        }
      }),

      // The new hash ends the link and the user's other sessions.
      'post password-reset-confirm': defineAction({
        body: z.object({ token: required('token'), password }),
        handler: async ({ body, c }) => {
          const user = await passwordReset.findUser(c, source, body.token)
          if (!user) throw authError('Invalid or expired token', 400)
          await setPassword(c, user, body.password)
        }
      })
    }),

    ...(passkeys && {
      'post passkey-login-options': ({ c }) =>
        passkeys.createAuthenticationOptions(c),

      'post passkey-login': defineAction({
        body: anyBody,
        handler: async ({ body, c }) => login(c, await verifyPasskey(c, body))
      }),

      'get passkeys': async ({ c }) => {
        const user = await checkAuthentication(c)
        const list = await credentials!.list(source, user, 'passkey')
        return list.map(({ id, name, createdAt, lastUsedAt }) => ({
          id,
          name,
          createdAt,
          lastUsedAt
        }))
      },

      'post passkey-options': async ({ c }) => {
        const user = await checkConfirmedAccess(c)
        return passkeys.createRegistrationOptions(
          c,
          user.username ?? '',
          await credentials!.list(source, user, 'passkey')
        )
      },

      'post passkeys': defineAction({
        body: anyBody,
        handler: async ({ body, c }) => {
          const user = await checkConfirmedAccess(c)
          const { id, name, createdAt } = await passkeys.verifyRegistration(
            c,
            credentials!,
            source,
            user,
            body
          )
          return { id, name, createdAt, lastUsedAt: null }
        }
      }),

      'delete passkeys/:id': async ({ params, c }) => {
        const user = await checkConfirmedAccess(c)
        const { data: id } = credentialId.safeParse(params.id)
        if (!id) throw new HttpError(404)
        const count = await credentials!.remove(source, user, 'passkey', id)
        if (count === 0) throw new HttpError(404)
      }
    }),

    ...(totp && {
      // The second step of the password logins of users with TOTP, with a TOTP
      // code or a backup code.
      'post login-code': defineAction({
        body: anyBody,
        handler: async ({ body: { code }, c }) => {
          const session = getSession(c)
          const { pendingLogin } = session.value
          const parsed = parseUserIdentifier(pendingLogin?.user)
          if (!(
            parsed?.name === source.name && pendingLogin!.expires > Date.now()
          )) {
            throw authError('Missing or expired login', 400)
          }
          const user = await source.findById(c, parsed.id)
          if (!user) throw authError('Code is incorrect')
          await checkTotpService('Code is incorrect').verifyCode(
            credentials!,
            source,
            user,
            code
          )
          delete session.value.pendingLogin
          return login(c, user)
        }
      }),

      'get totp': async ({ c }) => {
        const user = await checkAuthentication(c)
        const credential = await credentials!.first(source, user, 'totp')
        return {
          enabled: !!credential,
          backupCodes: credential?.data.backupCodes.length ?? 0
        }
      },

      'post totp': async ({ c }) => {
        const user = await checkConfirmedAccess(c)
        if (await hasTotp(c, user)) {
          throw authError('TOTP is already set up', 409)
        }
        return totp.createSecret(c, user)
      },

      'post totp-confirm': defineAction({
        body: anyBody,
        handler: async ({ body: { code }, c }) => {
          const user = await checkConfirmedAccess(c)
          const backupCodes = await totp.confirmSecret(
            c,
            credentials!,
            source,
            user,
            code
          )
          // The backup codes are stored hashed, so users see them only here.
          return { backupCodes }
        }
      }),

      'delete totp': async ({ c }) => {
        const user = await checkConfirmedAccess(c)
        await credentials!.remove(source, user, 'totp')
      }
    })
  }

  const controller: ControllerDefinition = {
    path,
    authorize: true,
    transacted: false,
    actions
  }
  const features = {
    hasPasskeys: !!passkeys,
    hasTotp: !!totp,
    hasPasswordChange: true,
    hasPasswordReset: !!passwordReset
  }
  return { controller, features }
}

export interface PasswordWritesOptions<U extends User> {
  source: UserSource<U>
  // The schema of new passwords, at least 8 characters by default.
  password?: z.ZodType<string>
}

// A mixin for the `post` and `patch :id` of a model controller of the users:
// the body sets `password`, which it stores as the user's `hash`. A `hash` in
// the body responds with 400. Users who change their own password keep their
// session, and their other sessions end. The controller writes the hash with
// the user that the handler beneath returns.
export function passwordWrites<U extends User>({
  source,
  password = defaultPassword
}: PasswordWritesOptions<U>) {
  const schema = z.object({
    password: password.optional(),
    hash: z
      .never({ error: `Unable to set 'hash', set 'password' instead.` })
      .optional()
  })

  const handler: Handler = async input => {
    const { c, next } = input
    if (!isPlainObject(input.body)) return next()
    const result = await schema.safeParseAsync(input.body)
    if (!result.success) {
      throw createValidationError(result.error.issues, bodyValidation)
    }
    const { password: value, ...body } = input.body
    if (value === undefined) return next()
    // The handlers beneath get the body without the password.
    input.body = body
    const user = (await next()) as U | undefined
    if (user) {
      user.hash = await hashPassword(result.data.password!)
      getSession(c).refreshFingerprint(source, user)
    }
    return user
  }

  return defineMixin({
    actions: {
      'post': handler,
      'patch :id': handler
    }
  })
}
