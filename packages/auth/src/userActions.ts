import type { Context } from 'hono'
import { z } from 'zod'
import { isString, parseDuration } from '@ditojs/utils'
import {
  defineAction,
  defineMixin,
  HttpError,
  type Actions
} from '@ditojs/server'
import { createAuthError, authenticationTimeout } from './authentication.ts'
import type { Credential, Credentials } from './credentials.ts'
import { createPasskeys, type PasskeysOptions } from './passkeys.ts'
import {
  createPasswordReset,
  type PasswordResetOptions
} from './passwordReset.ts'
import { hashPassword, verifyPassword } from './passwords.ts'
import { getSession } from './sessions.ts'
import { createTotp, type TotpOptions } from './totp.ts'
import {
  getUserIdentifier,
  parseUserIdentifier,
  type AuthUser,
  type UserSource
} from './users.ts'

// The login, session and security actions of the admin. The app adds CSRF
// protection.

export interface DefineUserActionsOptions<U extends AuthUser> {
  // The name that browsers and authenticator apps show, such as the app's
  // name. Passkeys and TOTP need it.
  name?: string
  // `true` enables passkeys with the default options.
  passkeys?: boolean | PasskeysOptions
  totp?: TotpOptions
  passwordReset?: PasswordResetOptions<U>
  // In milliseconds or as a duration such as `'24h'`, ten minutes by default.
  reconfirmAfter?: number | string
  afterLogin?: (context: { c: Context; user: U }) => unknown
}

interface UserActionsOptions<U extends AuthUser>
  extends DefineUserActionsOptions<U> {
  // Its `password` checks the new passwords.
  source: UserSource<U>
  credentials: Credentials
  secrets: string[]
}

const anyBody = z.record(z.string(), z.unknown())
// The ids of the `credential` table.
const credentialId = z.coerce
  .number()
  .int()
  .min(1)
  .max(2 ** 31 - 1)

// The app puts the mixin in a controller of its own: a model controller would
// flush and serialize the answers of the actions.
export function defineUserActions<U extends AuthUser>({
  source,
  credentials,
  secrets,
  name,
  afterLogin,
  ...options
}: UserActionsOptions<U>) {
  const reconfirmAfter = parseDuration(options.reconfirmAfter ?? '10m')
  const passkeyOptions = options.passkeys === true ? {} : options.passkeys
  const passkeys = passkeyOptions
    ? createPasskeys({ ...passkeyOptions, name, credentials })
    : null
  const totp = options.totp
    ? createTotp({ ...options.totp, name, credentials })
    : null
  const passwordReset = options.passwordReset
    ? createPasswordReset({ ...options.passwordReset, secrets, source })
    : null
  const { password } = source
  const checkAuthentication = async (c: Context) => {
    const user = await getSession(c).getUser<U>()
    if (!user) throw createAuthError('Unauthorized Access')
    return user
  }

  const checkConfirmedAccess = (c: Context) =>
    getSession(c).checkConfirmedAccess<U>()

  // Users with TOTP need a code. Without the TOTP feature, they get the error
  // of a wrong password, which doesn't reveal that the password was right.
  const hasTotp = async (user: U) =>
    !!(await credentials.findFirst(user, 'totp'))

  const login = async (c: Context, user: U) => {
    const session = getSession(c)
    session.login(user)
    try {
      if ('lastLogin' in user) {
        await source.patch(user, { lastLogin: new Date() })
      }
      session.confirmAccess(user, reconfirmAfter)
      await afterLogin?.({ c, user })
      return { user: await source.serialize(user) }
    } catch (error) {
      // A failed login leaves no user in the session.
      session.logout()
      throw error
    }
  }

  // Resolve to the user of the passkey that signed the session's challenge.
  const verifyPasskey = async (c: Context, response: any) => {
    const key = response?.id
    const credential = isString(key)
      ? await credentials.findByKey('passkey', key)
      : null
    const user = credential
      ? await source.findById(credential.userId)
      : null
    await passkeys!.verifyAuthentication(c, user ? credential : null, response)
    return user!
  }

  const setPassword = async (c: Context, user: U, password: string) => {
    await source.patch(user, { hash: await hashPassword(password) })
    getSession(c).refreshFingerprint(user)
  }

  const actions: Actions = {
    'post login': defineAction({
      body: anyBody,
      handler: async ({ body: { username, password }, c }) => {
        if (!username || !password) {
          throw createAuthError('Missing credentials', 400)
        }
        // Usernames that aren't strings are compared like unknown ones.
        const user = isString(username)
          ? await source.findByUsername(username)
          : null
        if (!((await verifyPassword(password, user?.hash)) && user)) {
          throw createAuthError('Password or username is incorrect')
        }
        if (await hasTotp(user)) {
          if (!totp) throw createAuthError('Password or username is incorrect')
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

    // The logged-in user. Without a login, the answer is empty.
    'get self': async ({ c }) => {
      const user = await getSession(c).getUser<U>()
      return user ? source.serialize(user) : undefined
    },

    // What the admin offers, also before the login:
    'get capabilities': () => ({
      hasPasskeys: !!passkeys,
      hasTotp: !!totp,
      hasPasswordChange: true,
      hasPasswordReset: !!passwordReset
    }),

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
            throw createAuthError('Passkey is incorrect')
          }
        } else if (!(await verifyPassword(password, user.hash))) {
          throw createAuthError('Password is incorrect')
        } else if (await hasTotp(user)) {
          if (!totp) throw createAuthError('Password is incorrect')
          if (!code) return { codeRequired: true }
          await totp.verifyCode(user, code)
        }
        getSession(c).confirmAccess(user, reconfirmAfter)
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
        body: z.object({ username: createRequiredString('username') }),
        handler: async ({ body: { username }, c }) => {
          const user = await source.findByUsername(username)
          if (user) passwordReset.sendLink(c, user)
        }
      }),

      // The new hash ends the link and the user's other sessions.
      'post password-reset-confirm': defineAction({
        body: z.object({ token: createRequiredString('token'), password }),
        handler: async ({ body, c }) => {
          const user = await passwordReset.findUser(body.token)
          if (!user) throw createAuthError('Invalid or expired token', 400)
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
        const list = await credentials.list(user, 'passkey')
        return list.map(toPasskey)
      },

      'post passkey-options': async ({ c }) => {
        const user = await checkConfirmedAccess(c)
        return passkeys.createRegistrationOptions(
          c,
          source.getUsername(user),
          await credentials.list(user, 'passkey')
        )
      },

      'post passkeys': defineAction({
        body: anyBody,
        handler: async ({ body, c }) => {
          const user = await checkConfirmedAccess(c)
          const credential = await passkeys.verifyRegistration(c, user, body)
          return toPasskey(credential)
        }
      }),

      'delete passkeys/:id': async ({ params, c }) => {
        const user = await checkConfirmedAccess(c)
        const { data: id } = credentialId.safeParse(params.id)
        if (!id) throw new HttpError(404)
        const count = await credentials.delete(user, 'passkey', id)
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
            throw createAuthError('Missing or expired login', 400)
          }
          const user = await source.findById(parsed.id)
          if (!user) throw createAuthError('Code is incorrect')
          await totp.verifyCode(user, code)
          delete session.value.pendingLogin
          return login(c, user)
        }
      }),

      'get totp': async ({ c }) => {
        const user = await checkAuthentication(c)
        const credential = await credentials.findFirst(user, 'totp')
        return {
          enabled: !!credential,
          backupCodes: credential?.data.backupCodes.length ?? 0
        }
      },

      'post totp': async ({ c }) => {
        const user = await checkConfirmedAccess(c)
        if (await hasTotp(user)) {
          throw createAuthError('TOTP is already set up', 409)
        }
        return totp.createSecret(c, user)
      },

      'post totp-confirm': defineAction({
        body: anyBody,
        handler: async ({ body: { code }, c }) => {
          const user = await checkConfirmedAccess(c)
          const backupCodes = await totp.confirmSecret(c, user, code)
          // The backup codes are stored hashed, so users see them only here.
          return { backupCodes }
        }
      }),

      'delete totp': async ({ c }) => {
        const user = await checkConfirmedAccess(c)
        await credentials.delete(user, 'totp')
      }
    })
  }

  // Each handler checks the login and confirmed access that it needs, and
  // TOTP opens a transaction of its own, so failed codes stay counted when the
  // request fails:
  return defineMixin({ authorize: true, transacted: false, actions })
}

function createRequiredString(name: string) {
  const error = `The ${name} is required.`
  return z.string({ error }).min(1, error)
}

function toPasskey({ id, name, createdAt, lastUsedAt }: Credential) {
  return { id, name, createdAt, lastUsedAt }
}
