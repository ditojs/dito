import { z } from 'zod'
import { isFunction, isString } from '@ditojs/utils'
import {
  action,
  HttpError,
  type ActionValue,
  type Actions,
  type ControllerDefinition,
  type DitoContext
} from '@ditojs/server-next'
import type { Credentials } from './credentials.ts'
import { authError } from './errors.ts'
import {
  authenticationTimeout,
  getUserIdentifier,
  parseUserIdentifier
} from './identifiers.ts'
import type { Passkeys } from './passkeys.ts'
import type { PasswordReset } from './password-reset.ts'
import { hashPassword, verifyPassword } from './passwords.ts'
import { getSession } from './sessions.ts'
import type { Totp } from './totp.ts'
import type { UserSource } from './types.ts'

// The actions of Dito 6's `UsersController` with its paths and status codes.
// Successes answer its bodies, which the admin reads, and failures answer as
// Problem Details. They need the middleware of `createSessions()`. Each
// handler checks the login and the confirmed access it needs itself. The
// actions run outside the app's transactions, so the failures of TOTP codes
// stay counted when the request fails, see `totp()`. The app adds CSRF
// protection.

export interface UsersRoutesOptions<U> {
  // The path of the users under the app's prefix, such as `admins`.
  path: string
  source: UserSource<U>
  // Needed for passkeys and TOTP.
  credentials?: Credentials
  features?: {
    // From `@ditojs/auth/passkeys` and `@ditojs/auth/totp`.
    passkeys?: Passkeys
    totp?: Totp
    passwordReset?: PasswordReset
    // `POST password`, true by default.
    passwordChange?: boolean
  }
  // In milliseconds, ten minutes by default.
  reconfirmAfter?: number
  afterLogin?: (ctx: DitoContext, user: U) => unknown
}

export interface AuthenticationFeatures {
  hasPasskeys: boolean
  hasTotp: boolean
  hasPasswordChange: boolean
  hasPasswordReset: boolean
}

const anyBody = z.record(z.string(), z.unknown())
const requiredPassword = z
  .string({ error: 'The password is required.' })
  .min(1, 'The password is required.')

// The controller of the actions, which the app passes to `createApp()`, or
// puts in the `features` of its own controller of the users. The returned
// `features` tell the admin what it offers, as `api.authentication`.
export function usersRoutes<U>({
  path,
  source,
  credentials,
  features: {
    passkeys,
    totp,
    passwordReset,
    passwordChange = true
  } = {},
  reconfirmAfter = 10 * 60 * 1000,
  afterLogin
}: UsersRoutesOptions<U>) {
  if ((passkeys || totp) && !credentials) {
    throw new Error('Unable to use passkeys or TOTP without credentials.')
  }
  const usernameField = source.usernameField ?? 'username'

  const getUser = async (ctx: DitoContext) => {
    const user = await getSession(ctx).getUser(source)
    if (!user) throw authError('Unauthorized Access')
    return user
  }

  const checkConfirmedAccess = (ctx: DitoContext) =>
    getSession(ctx).checkConfirmedAccess(source)

  const hasTotp = async (ctx: DitoContext, user: U) => (
    !!credentials && !!(await credentials.first(ctx, source, user, 'totp'))
  )

  // Users with TOTP always need a code, also when the app doesn't use TOTP.
  // Then they get the answer of a wrong password, which doesn't tell that the
  // password was right.
  const checkTotp = (message: string) => {
    if (!totp) throw authError(message)
    return totp
  }

  // Logs in the user that `authenticate()` resolves to, unless it needs a
  // code first.
  const handleLogin = async (
    ctx: DitoContext,
    authenticate: () => Promise<{ user?: U | null; codeRequired?: boolean }>
  ) => {
    const { user, codeRequired } = await authenticate()
    if (codeRequired) {
      return {
        success: false,
        codeRequired: true,
        authenticated: false,
        user: null
      }
    }
    if (!user) throw authError('Authentication error')
    const session = getSession(ctx)
    session.login(source, user)
    await source.touchLogin?.(ctx, user)
    session.confirmAccess(source, user, reconfirmAfter)
    await afterLogin?.(ctx, user)
    return {
      success: true,
      authenticated: true,
      user: await source.toJSON(ctx, user)
    }
  }

  // The user of the passkey that answered the challenge in the session.
  const verifyPasskey = async (ctx: DitoContext, response: any) => {
    const key = response?.id
    const credential = isString(key)
      ? await credentials!.findByKey(ctx, source, 'passkey', key as string)
      : null
    const user = credential
      ? await source.findById(ctx, credential.userId)
      : null
    await passkeys!.verifyAuthentication(
      ctx,
      getSession(ctx).value,
      credentials!,
      user ? credential : null,
      response
    )
    return user!
  }

  const setPassword = async (ctx: DitoContext, user: U, password: string) => {
    const hash = await hashPassword(password)
    await source.setPassword(ctx, user, hash)
    getSession(ctx).refreshFingerprint(source, user, hash)
  }

  const actions: Record<string, ActionValue> = {
    'post login': action({
      body: anyBody,
      handler: async ctx => {
        const body = ctx.body
        return handleLogin(ctx, async () => {
          const { [usernameField]: username, password } = body
          if (!username || !password) {
            throw authError('Missing credentials', 400)
          }
          // Usernames that aren't strings are compared like unknown ones.
          const user = isString(username)
            ? await source.findByUsername(ctx, username as string)
            : null
          const hash = user ? source.describe(user).hash : null
          if (!((await verifyPassword(password, hash)) && user)) {
            throw authError('Password or username is incorrect')
          }
          if (await hasTotp(ctx, user)) {
            checkTotp('Password or username is incorrect')
            // The login completes with a code, through `POST login-code`.
            const session = getSession(ctx)
            session.value.pendingLogin = {
              user: getUserIdentifier(source, user),
              expires: Date.now() + authenticationTimeout
            }
            session.regenerate()
            return { codeRequired: true }
          }
          return { user }
        })
      }
    }),

    // The second step of the password logins of users with TOTP, with a TOTP
    // code or a backup code.
    'post login-code': action({
      body: anyBody,
      handler: async ctx => {
        const { code } = ctx.body
        return handleLogin(ctx, async () => {
          const session = getSession(ctx)
          const { pendingLogin } = session.value
          const parsed = parseUserIdentifier(pendingLogin?.user)
          if (!(
            parsed?.name === source.name && pendingLogin!.expires > Date.now()
          )) {
            throw authError('Missing or expired login', 400)
          }
          const user = await source.findById(ctx, parsed.id)
          if (!user) throw authError('Code is incorrect')
          await checkTotp('Code is incorrect').verifyCode(
            ctx,
            credentials!,
            source,
            user,
            code
          )
          delete session.value.pendingLogin
          return { user }
        })
      }
    }),

    'post logout': async ctx => {
      const session = getSession(ctx)
      const user = await session.getUser(source)
      if (user) session.logout()
      return { success: !!user, authenticated: false }
    },

    'get session': async ctx => {
      const user = await getSession(ctx).getUser(source)
      return {
        authenticated: !!user,
        user: user ? await source.toJSON(ctx, user) : null
      }
    },

    'get self': async ctx => {
      const user = await getSession(ctx).getUser(source)
      return user ? source.toJSON(ctx, user) : null
    },

    // Confirms the access of the logged-in user with the password, and the
    // code of users with TOTP, or with a passkey.
    'post confirm-access': action({
      body: anyBody,
      handler: async ctx => {
        const user = await getUser(ctx)
        const { password, code, passkey } = ctx.body
        if (passkeys && passkey) {
          // The passkeys of other users verify too, but don't confirm.
          const passkeyUser = await verifyPasskey(ctx, passkey)
          if (
            getUserIdentifier(source, passkeyUser) !==
            getUserIdentifier(source, user)
          ) {
            throw authError('Passkey is incorrect')
          }
        } else if (
          !(
            password &&
            (await verifyPassword(password, source.describe(user).hash))
          )
        ) {
          throw authError('Password is incorrect')
        } else if (await hasTotp(ctx, user)) {
          const feature = checkTotp('Password is incorrect')
          if (!code) return { success: false, codeRequired: true }
          await feature.verifyCode(ctx, credentials!, source, user, code)
        }
        getSession(ctx).confirmAccess(source, user, reconfirmAfter)
        return { success: true }
      }
    }),

    // Users change their own values, without the password and hashes, and
    // with confirmed access for a new username, as password resets go to it.
    'patch self': action({
      body: z.looseObject({
        password: requiredPassword.optional(),
        hash: z.never({ error: `Unable to change 'hash'.` }).optional()
      }),
      handler: async ctx => {
        const user = await getUser(ctx)
        const { password, ...values } = ctx.body
        const username = values[usernameField]
        if (
          password !== undefined || (
            username !== undefined &&
            username !== source.describe(user).username
          )
        ) {
          await checkConfirmedAccess(ctx)
        }
        if (password !== undefined) await setPassword(ctx, user, password)
        const updated =
          Object.keys(values).length > 0
            ? await source.update!(ctx, user, values)
            : user
        return source.toJSON(ctx, updated)
      }
    }),

    'post password': action({
      body: z.object({ password: requiredPassword }),
      handler: async ctx => {
        const user = await checkConfirmedAccess(ctx)
        await setPassword(ctx, user, ctx.body.password)
        return { success: true }
      }
    }),

    // The same answer whether the user exists or not, so the answer doesn't
    // tell which usernames exist.
    'post password-reset': action({
      body: z.object({
        [usernameField]: z
          .string({
            error: issue => (
              `${issue.input === undefined ? 'Missing' : 'Invalid'} ` +
              `'${usernameField}'`
            )
          })
          .min(1, `Missing '${usernameField}'`)
      }),
      handler: async ctx => {
        const { [usernameField]: username } = ctx.body
        const user = await source.findByUsername(ctx, username!)
        if (user) passwordReset!.request(ctx, source, user)
        return { success: true }
      }
    }),

    // The new hash ends the link and the user's other sessions.
    'post password-reset-confirm': action({
      body: z.object({
        token: z
          .string({ error: 'The token is required.' })
          .min(1, 'The token is required.'),
        password: requiredPassword
      }),
      handler: async ctx => {
        const { token, password } = ctx.body
        const user = await passwordReset!.findUser(ctx, source, token)
        if (!user) throw authError('Invalid or expired token', 400)
        await setPassword(ctx, user, password)
        return { success: true }
      }
    }),

    'post passkey-login-options': ctx =>
      passkeys!.createAuthenticationOptions(ctx, getSession(ctx).value),

    'post passkey-login': action({
      body: anyBody,
      handler: async ctx => {
        const response = ctx.body
        return handleLogin(ctx, async () => ({
          user: await verifyPasskey(ctx, response)
        }))
      }
    }),

    'get passkeys': async ctx => {
      const user = await getUser(ctx)
      const list = await credentials!.list(ctx, source, user, 'passkey')
      return list.map(({ id, name, createdAt, lastUsedAt }) => ({
        id,
        name,
        createdAt,
        lastUsedAt
      }))
    },

    'post passkey-options': async ctx => {
      const user = await checkConfirmedAccess(ctx)
      return passkeys!.createRegistrationOptions(
        ctx,
        getSession(ctx).value,
        source.describe(user).username,
        await credentials!.list(ctx, source, user, 'passkey')
      )
    },

    'post passkeys': action({
      body: anyBody,
      handler: async ctx => {
        const user = await checkConfirmedAccess(ctx)
        const { id, name, createdAt } = await passkeys!.verifyRegistration(
          ctx,
          getSession(ctx).value,
          credentials!,
          source,
          user,
          ctx.body
        )
        return { id, name, createdAt, lastUsedAt: null }
      }
    }),

    'delete passkeys/:id': async ctx => {
      const user = await checkConfirmedAccess(ctx)
      const count = await credentials!.remove(
        ctx,
        source,
        user,
        'passkey',
        Number(ctx.params.id)
      )
      if (count === 0) throw new HttpError(404)
      return { success: true }
    },

    'get totp': async ctx => {
      const user = await getUser(ctx)
      const credential = await credentials!.first(ctx, source, user, 'totp')
      return {
        enabled: !!credential,
        backupCodes: credential?.data.backupCodes.length ?? 0
      }
    },

    'post totp': async ctx => {
      const user = await checkConfirmedAccess(ctx)
      if (await hasTotp(ctx, user)) {
        throw authError('TOTP is already set up', 409)
      }
      return totp!.createSecret(getSession(ctx).value, source, user)
    },

    'post totp-confirm': action({
      body: anyBody,
      handler: async ctx => {
        const user = await checkConfirmedAccess(ctx)
        const { code } = ctx.body
        const backupCodes = await totp!.confirmSecret(
          ctx,
          getSession(ctx).value,
          credentials!,
          source,
          user,
          code
        )
        // The backup codes are stored hashed, so users only see them now.
        return { backupCodes }
      }
    }),

    'delete totp': async ctx => {
      const user = await checkConfirmedAccess(ctx)
      await credentials!.remove(ctx, source, user, 'totp')
      return { success: true }
    }
  }

  const routed = [
    'post login',
    'post logout',
    'get session',
    'get self',
    'post confirm-access',
    ...(source.update ? ['patch self'] : []),
    ...(passwordChange ? ['post password'] : []),
    ...(
      passwordReset
        ? ['post password-reset', 'post password-reset-confirm']
        : []
    ),
    ...(
      passkeys
        ? [
            'post passkey-login-options',
            'post passkey-login',
            'get passkeys',
            'post passkey-options',
            'post passkeys',
            'delete passkeys/:id'
          ]
        : []
    ),
    ...(
      totp
        ? [
            'post login-code',
            'get totp',
            'post totp',
            'post totp-confirm',
            'delete totp'
          ]
        : []
    )
  ]
  const collection = Object.fromEntries(
    routed.map(name => {
      const value = actions[name]!
      const def = isFunction(value) ? { handler: value } : value
      return [name, { ...def, transaction: false }]
    })
  ) as Actions
  const controller: ControllerDefinition = { path, collection }
  const isRouted = (...names: string[]) =>
    names.every(name => routed.includes(name))
  const features: AuthenticationFeatures = {
    hasPasskeys: isRouted('post passkey-login', 'post passkeys'),
    hasTotp: isRouted('post login-code', 'post totp'),
    hasPasswordChange: isRouted('post password'),
    hasPasswordReset: isRouted('post password-reset')
  }
  return { controller, features }
}
