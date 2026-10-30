import { Hono, type Handler } from 'hono'
import { isPlainObject, isString } from '@ditojs/utils'
import { ProblemError } from '@ditojs/server-next'
import type { Credentials } from './credentials.ts'
import { authError, validationError } from './errors.ts'
import {
  authenticationTimeout,
  getUserIdentifier,
  parseUserIdentifier
} from './identifiers.ts'
import type { Passkeys } from './passkeys.ts'
import type { PasswordReset } from './password-reset.ts'
import { hashPassword, verifyPassword } from './passwords.ts'
import type { Sessions } from './sessions.ts'
import type { Totp } from './totp.ts'
import type { AnyContext, UserSource } from './types.ts'

// The actions of Dito 6's `UsersController` with its paths, status codes and
// bodies, which the admin reads. The logins answer their failures in
// `{ success: false, error }`, the other actions as Problem Details with the
// `message` of Dito 6's errors. Each handler checks the login and the
// confirmed access it needs itself. Nothing here runs in a transaction of its
// own, except the TOTP codes, see `totp()`. The app adds CSRF protection, such
// as Hono's `csrf()`.

export interface UsersRoutesOptions<U> {
  sessions: Sessions
  source: UserSource<U>
  // Needed for passkeys and TOTP.
  credentials?: Credentials
  features?: {
    passkeys?: Passkeys
    totp?: Totp
    passwordReset?: PasswordReset
    // `POST password`, true by default.
    passwordChange?: boolean
  }
  // In milliseconds, ten minutes by default.
  reconfirmAfter?: number
  afterLogin?: (c: AnyContext, user: U) => unknown
}

export interface AuthenticationFeatures {
  hasPasskeys: boolean
  hasTotp: boolean
  hasPasswordChange: boolean
  hasPasswordReset: boolean
}

export function createUserHandlers<U>({
  sessions,
  source,
  credentials,
  features = {},
  reconfirmAfter = 10 * 60 * 1000,
  afterLogin
}: UsersRoutesOptions<U>) {
  const { passkeys, totp, passwordReset, passwordChange = true } = features
  if ((passkeys || totp) && !credentials) {
    throw new Error('Unable to use passkeys or TOTP without credentials.')
  }
  const usernameField = source.usernameField ?? 'username'

  const getUser = async (c: AnyContext) => {
    const user = await sessions.getUser(c, source)
    if (!user) throw authError('Unauthorized Access')
    return user
  }

  const hasTotp = async (c: AnyContext, user: U) => (
    !!credentials && !!(await credentials.first(c, source, user, 'totp'))
  )

  // Users with TOTP always need a code, also when the app no longer uses
  // TOTP. Then they get the answer of a wrong password, which doesn't tell
  // that the password was right.
  const checkTotp = (message: string) => {
    if (!totp) throw authError(message)
    return totp
  }

  // Logs in the user that `authenticate()` resolves to, unless it needs a
  // code first.
  const handleLogin = async (
    c: AnyContext,
    authenticate: () => Promise<{ user?: U | null; codeRequired?: boolean }>
  ) => {
    try {
      const { user, codeRequired } = await authenticate()
      if (codeRequired) {
        return c.json({
          success: false,
          codeRequired: true,
          authenticated: false,
          user: null
        })
      }
      if (!user) throw authError('Authentication error')
      sessions.login(c, source, user)
      await source.touchLogin?.(c, user)
      sessions.confirmAccess(c, source, user, reconfirmAfter)
      await afterLogin?.(c, user)
      return c.json({
        success: true,
        authenticated: true,
        user: await source.toJSON(c, user)
      })
    } catch (error) {
      if (error instanceof ProblemError && error.status < 500) {
        return c.json(
          {
            success: false,
            authenticated: false,
            user: null,
            error: error.detail ?? error.title
          },
          error.status as 400
        )
      }
      throw error
    }
  }

  // The user of the passkey that answered the challenge in the session.
  const verifyPasskey = async (c: AnyContext, response: any) => {
    const key = response?.id
    const credential = isString(key)
      ? await credentials!.findByKey(c, source, 'passkey', key as string)
      : null
    const user = credential
      ? await source.findById(c, credential.userId)
      : null
    await passkeys!.verifyAuthentication(
      c,
      sessions.session(c),
      credentials!,
      user ? credential : null,
      response
    )
    return user!
  }

  const setPassword = async (c: AnyContext, user: U, password: unknown) => {
    if (!isString(password) || !password) {
      throw validationError('password', 'The password is required.')
    }
    const hash = await hashPassword(password as string)
    await source.setPassword(c, user, hash)
    sessions.refreshFingerprint(c, source, user, hash)
  }

  const handlers: Record<string, Handler> = {
    'post login': async c => {
      const body = await readBody(c)
      return handleLogin(c, async () => {
        const { [usernameField]: username, password } = body
        if (!username || !password) {
          throw authError('Missing credentials', 400)
        }
        // Usernames that aren't strings are compared like unknown ones.
        const user = isString(username)
          ? await source.findByUsername(c, username as string)
          : null
        const hash = user ? source.describe(user).hash : null
        if (!((await verifyPassword(password, hash)) && user)) {
          throw authError('Password or username is incorrect')
        }
        if (await hasTotp(c, user)) {
          checkTotp('Password or username is incorrect')
          // The login completes with a code, through `POST login-code`.
          sessions.session(c).pendingLogin = {
            user: getUserIdentifier(source, user),
            expires: Date.now() + authenticationTimeout
          }
          sessions.regenerate(c)
          return { codeRequired: true }
        }
        return { user }
      })
    },

    // The second step of the password logins of users with TOTP, with a TOTP
    // code or a backup code.
    'post login-code': async c => {
      const { code } = await readBody(c)
      return handleLogin(c, async () => {
        const session = sessions.session(c)
        const { pendingLogin } = session
        const parsed = parseUserIdentifier(pendingLogin?.user)
        if (!(
          parsed?.name === source.name && pendingLogin!.expires > Date.now()
        )) {
          throw authError('Missing or expired login', 400)
        }
        const user = await source.findById(c, parsed.id)
        if (!user) throw authError('Code is incorrect')
        await checkTotp('Code is incorrect').verifyCode(
          c,
          credentials!,
          source,
          user,
          code
        )
        delete session.pendingLogin
        return { user }
      })
    },

    'post logout': async c => {
      const user = await sessions.getUser(c, source)
      if (user) sessions.logout(c)
      return c.json({ success: !!user, authenticated: false })
    },

    'get session': async c => {
      const user = await sessions.getUser(c, source)
      return c.json({
        authenticated: !!user,
        user: user ? await source.toJSON(c, user) : null
      })
    },

    'get self': async c => {
      const user = await sessions.getUser(c, source)
      return c.json(user ? await source.toJSON(c, user) : null)
    },

    // Confirms the access of the logged-in user with the password, and the
    // code of users with TOTP, or with a passkey.
    'post confirm-access': async c => {
      const user = await getUser(c)
      const { password, code, passkey } = await readBody(c)
      if (passkeys && passkey) {
        // The passkeys of other users verify too, but don't confirm.
        const passkeyUser = await verifyPasskey(c, passkey)
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
      } else if (await hasTotp(c, user)) {
        const feature = checkTotp('Password is incorrect')
        if (!code) return c.json({ success: false, codeRequired: true })
        await feature.verifyCode(c, credentials!, source, user, code)
      }
      sessions.confirmAccess(c, source, user, reconfirmAfter)
      return c.json({ success: true })
    },

    // Users change their own values, without the password and hashes, and
    // with confirmed access for a new username, as password resets go to it.
    'patch self': async c => {
      const user = await getUser(c)
      const { password, ...values } = await readBody(c)
      if ('hash' in values) {
        throw validationError('hash', `Unable to change 'hash'.`)
      }
      const username = values[usernameField]
      if (
        password !== undefined ||
        (username !== undefined && username !== source.describe(user).username)
      ) {
        await sessions.checkConfirmedAccess(c, source)
      }
      if (password !== undefined) await setPassword(c, user, password)
      const updated =
        Object.keys(values).length > 0
          ? await source.update!(c, user, values)
          : user
      return c.json((await source.toJSON(c, updated)) as never)
    },

    'post password': async c => {
      const user = await sessions.checkConfirmedAccess(c, source)
      const { password } = await readBody(c)
      await setPassword(c, user, password)
      return c.json({ success: true })
    },

    // The same answer whether the user exists or not, so the answer doesn't
    // tell which usernames exist.
    'post password-reset': async c => {
      const { [usernameField]: username } = await readBody(c)
      if (!username || !isString(username)) {
        throw authError(
          `${username ? 'Invalid' : 'Missing'} '${usernameField}'`,
          400
        )
      }
      const user = await source.findByUsername(c, username as string)
      if (user) passwordReset!.request(c, source, user)
      return c.json({ success: true })
    },

    // The new hash ends the link and the user's other sessions.
    'post password-reset-confirm': async c => {
      const { token, password } = await readBody(c)
      if (!isString(token) || !token) {
        throw validationError('token', 'The token is required.')
      }
      const user = await passwordReset!.findUser(c, source, token)
      if (!user) throw authError('Invalid or expired token', 400)
      await setPassword(c, user, password)
      return c.json({ success: true })
    },

    'post passkey-login-options': async c =>
      c.json(
        await passkeys!.createAuthenticationOptions(c, sessions.session(c))
      ),

    'post passkey-login': async c => {
      const response = await readBody(c)
      return handleLogin(c, async () => ({
        user: await verifyPasskey(c, response)
      }))
    },

    'get passkeys': async c => {
      const user = await getUser(c)
      const list = await credentials!.list(c, source, user, 'passkey')
      return c.json(
        list.map(({ id, name, createdAt, lastUsedAt }) => ({
          id,
          name,
          createdAt,
          lastUsedAt
        }))
      )
    },

    'post passkey-options': async c => {
      const user = await sessions.checkConfirmedAccess(c, source)
      return c.json(
        await passkeys!.createRegistrationOptions(
          c,
          sessions.session(c),
          source.describe(user).username,
          await credentials!.list(c, source, user, 'passkey')
        )
      )
    },

    'post passkeys': async c => {
      const user = await sessions.checkConfirmedAccess(c, source)
      const { id, name, createdAt } = await passkeys!.verifyRegistration(
        c,
        sessions.session(c),
        credentials!,
        source,
        user,
        await readBody(c)
      )
      return c.json({ id, name, createdAt, lastUsedAt: null })
    },

    'delete passkeys/:id': async c => {
      const user = await sessions.checkConfirmedAccess(c, source)
      const id = Number(c.req.param('id'))
      const count = Number.isInteger(id)
        ? await credentials!.remove(c, source, user, 'passkey', id)
        : 0
      if (count === 0) throw new ProblemError({ status: 404 })
      return c.json({ success: true })
    },

    'get totp': async c => {
      const user = await getUser(c)
      const credential = await credentials!.first(c, source, user, 'totp')
      return c.json({
        enabled: !!credential,
        backupCodes: credential?.data.backupCodes.length ?? 0
      })
    },

    'post totp': async c => {
      const user = await sessions.checkConfirmedAccess(c, source)
      if (await hasTotp(c, user)) {
        throw authError('TOTP is already set up', 409)
      }
      return c.json(await totp!.createSecret(sessions.session(c), source, user))
    },

    'post totp-confirm': async c => {
      const user = await sessions.checkConfirmedAccess(c, source)
      const { code } = await readBody(c)
      const backupCodes = await totp!.confirmSecret(
        c,
        sessions.session(c),
        credentials!,
        source,
        user,
        code
      )
      // The backup codes are stored hashed, so users only see them now.
      return c.json({ backupCodes })
    },

    'delete totp': async c => {
      const user = await sessions.checkConfirmedAccess(c, source)
      await credentials!.remove(c, source, user, 'totp')
      return c.json({ success: true })
    }
  }

  const routed = (names: string[]) =>
    Object.fromEntries(names.map(name => [name, handlers[name]]))

  return {
    ...routed([
      'post login',
      'post logout',
      'get session',
      'get self',
      'post confirm-access'
    ]),
    ...(source.update && routed(['patch self'])),
    ...(passwordChange && routed(['post password'])),
    ...(passwordReset &&
    routed(['post password-reset', 'post password-reset-confirm'])),
    ...(passkeys &&
    routed([
      'post passkey-login-options',
      'post passkey-login',
      'get passkeys',
      'post passkey-options',
      'post passkeys',
      'delete passkeys/:id'
    ])),
    ...(totp &&
    routed([
      'post login-code',
      'get totp',
      'post totp',
      'post totp-confirm',
      'delete totp'
    ]))
  } as Record<string, Handler>
}

// The Hono app of the handlers, which the app mounts at the path of its
// users, such as `/api/admin/admins`, before its own routes of the users.
// `features` tells the admin what it offers, as `api.authentication`.
export function usersRoutes<U>(options: UsersRoutesOptions<U>) {
  const handlers = createUserHandlers(options)
  const app = new Hono()
  for (const [key, handler] of Object.entries(handlers)) {
    const [verb, path] = key.split(' ')
    app.on(verb.toUpperCase(), `/${path}`, handler)
  }
  const isRouted = (...names: string[]) => names.every(name => handlers[name])
  const features: AuthenticationFeatures = {
    hasPasskeys: isRouted('post passkey-login', 'post passkeys'),
    hasTotp: isRouted('post login-code', 'post totp'),
    hasPasswordChange: isRouted('post password'),
    hasPasswordReset: isRouted('post password-reset')
  }
  return { app, features, handlers }
}

async function readBody(c: AnyContext): Promise<Record<string, any>> {
  const body = await c.req.json().catch(() => null)
  return isPlainObject(body) ? body : {}
}
