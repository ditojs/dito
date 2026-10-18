import { vi } from 'vitest'
import { startAuthentication } from '@simplewebauthn/browser'
import { AdminContext } from './AdminContext.ts'
import AdminUser from '../AdminUser.js'

// The DOM of the tests has no WebAuthn, so we answer the passkey login with a
// fixed response. The e2e tests run it in a browser:
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(async () => ({ id: 'passkey' }))
}))

const user = { id: 1, username: 'tester' }

// Creates a session with an API that answers the `api.users` requests through
// `responses`, keyed by method and path, e.g. `'get /session'`, and with a
// view registry, dialogs and notifications that record their calls.
function createSession({
  responses = {},
  loginData = [{ username: 'tester', password: 'secret' }],
  loginCodes = [],
  passwordResets = [],
  newPasswords = [],
  accessConfirmations = [],
  resolvedViews = [true],
  redirectAfterLogin = null
} = {}) {
  const api = {
    users: {
      login: { method: 'post', path: 'login' },
      logout: { method: 'post', path: 'logout' },
      session: { method: 'get', path: 'session' },
      passkeyLoginOptions: { method: 'post', path: 'passkey-login-options' },
      passkeyLogin: { method: 'post', path: 'passkey-login' },
      loginCode: { method: 'post', path: 'login-code' },
      passwordReset: { method: 'post', path: 'password-reset' },
      passwordResetConfirm: { method: 'post', path: 'password-reset-confirm' },
      confirmAccess: { method: 'post', path: 'confirm-access' }
    },
    resources: { any: resource => `/${resource.path}` },
    getApiUrl: ({ url }) => url,
    request: vi.fn(async ({ method, url }) => {
      const response = responses[`${method} ${url}`]
      if (response instanceof Error) throw response
      return { data: typeof response === 'function' ? response() : response }
    })
  }
  const viewRegistry = {
    resolve: vi.fn(async () => resolvedViews.shift() ?? true),
    clear: vi.fn()
  }
  const adminContext = new AdminContext({
    api,
    viewRegistry,
    settings: {},
    authentication: {},
    login: { redirectAfterLogin }
  })
  const dialogs = {
    login: vi.fn(async () => loginData.shift() ?? null),
    code: vi.fn(async () => loginCodes.shift() ?? null),
    passwordReset: vi.fn(async () => passwordResets.shift() ?? null),
    newPassword: vi.fn(async () => newPasswords.shift() ?? null),
    confirmAccess: vi.fn(async () => accessConfirmations.shift() ?? null)
  }
  // Tell the dialogs apart by their submit buttons:
  const submitButtons = {
    login: 'login',
    verify: 'code',
    send: 'passwordReset',
    change: 'newPassword',
    confirm: 'confirmAccess'
  }
  const notify = vi.fn()
  adminContext.attachDialogsAndNotifications({
    showDialog: dialog => {
      const key = Object.keys(submitButtons).find(key => key in dialog.buttons)
      return dialogs[submitButtons[key]](dialog)
    },
    notify
  })
  const { session } = adminContext
  return { session, adminContext, api, viewRegistry, dialogs, notify }
}

describe('Session', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('start()', () => {
    it('resolves the views for the user of the session', async () => {
      const { session, adminContext, viewRegistry, dialogs } = createSession({
        responses: { 'get /session': { user: { ...user } } }
      })
      await session.start()
      expect(adminContext.user).toEqual(user)
      expect(adminContext.user).toBeInstanceOf(AdminUser)
      expect(viewRegistry.resolve).toHaveBeenCalledOnce()
      expect(dialogs.login).not.toHaveBeenCalled()
    })

    it('asks to log in without a user in the session', async () => {
      const { session, adminContext, api, viewRegistry } = createSession({
        responses: {
          'get /session': { user: null },
          'post /login': { user: { ...user } }
        }
      })
      await session.start()
      expect(api.request).toHaveBeenLastCalledWith({
        method: 'post',
        url: '/login',
        data: { username: 'tester', password: 'secret' }
      })
      expect(adminContext.user).toEqual(user)
      expect(viewRegistry.resolve).toHaveBeenCalledOnce()
    })

    it('asks to log in again when the views fail to resolve', async () => {
      const { session, dialogs, viewRegistry } = createSession({
        responses: {
          'get /session': { user: { ...user } },
          'post /login': { user: { ...user } }
        },
        resolvedViews: [false, true]
      })
      await session.start()
      expect(dialogs.login).toHaveBeenCalledOnce()
      expect(viewRegistry.resolve).toHaveBeenCalledTimes(2)
    })
  })

  describe('start() with a password reset link', () => {
    const resetUrl = '/admin/books?page=2#password-reset=token'
    const getPath = () => location.pathname + location.search + location.hash

    beforeEach(() => {
      history.replaceState(null, '', resetUrl)
    })

    afterEach(() => {
      history.replaceState(null, '', '/')
    })

    it('sets the new password, and then asks to log in', async () => {
      const { session, api, notify, dialogs } = createSession({
        responses: {
          'post /password-reset-confirm': { success: true },
          'get /session': { user: null },
          'post /login': { user: { ...user } }
        },
        newPasswords: [{ password: 'changed', confirmation: 'changed' }]
      })
      await session.start()
      expect(api.request).toHaveBeenCalledWith({
        method: 'post',
        url: '/password-reset-confirm',
        data: { token: 'token', password: 'changed' }
      })
      expect(notify).toHaveBeenCalledWith({
        type: 'success',
        text: 'Your password was changed. Please log in.'
      })
      expect(dialogs.login).toHaveBeenCalledOnce()
      expect(getPath()).toBe('/admin/books?page=2')
    })

    it('notifies invalid tokens, and then asks to log in', async () => {
      const error = 'Invalid or expired token'
      const { session, notify, dialogs } = createSession({
        responses: {
          'post /password-reset-confirm': Object.assign(new Error(error), {
            response: { status: 400, data: { message: error } }
          }),
          'get /session': { user: null },
          'post /login': { user: { ...user } }
        },
        newPasswords: [{ password: 'changed', confirmation: 'changed' }]
      })
      await session.start()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text: error })
      )
      expect(dialogs.login).toHaveBeenCalledOnce()
      expect(getPath()).toBe('/admin/books?page=2')
    })

    it('asks again with the token for invalid passwords', async () => {
      let attempt = 0
      const { session, api, notify, dialogs } = createSession({
        responses: {
          'post /password-reset-confirm': () => {
            if (attempt++ === 0) {
              throw Object.assign(new Error('Validation error'), {
                response: {
                  status: 400,
                  data: {
                    type: 'ModelValidation',
                    message: 'The provided data is not valid',
                    errors: {
                      password: [
                        { message: 'must NOT have fewer than 6 characters' }
                      ]
                    }
                  }
                }
              })
            }
            return { success: true }
          },
          'get /session': { user: null },
          'post /login': { user: { ...user } }
        },
        newPasswords: [
          { password: 'short', confirmation: 'short' },
          { password: 'changed', confirmation: 'changed' }
        ]
      })
      await session.start()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text: ['password must NOT have fewer than 6 characters']
        })
      )
      expect(dialogs.newPassword).toHaveBeenCalledTimes(2)
      expect(api.request).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: '/login' })
      )
      expect(api.request).toHaveBeenCalledWith({
        method: 'post',
        url: '/password-reset-confirm',
        data: { token: 'token', password: 'changed' }
      })
      expect(notify).toHaveBeenCalledWith({
        type: 'success',
        text: 'Your password was changed. Please log in.'
      })
    })

    it('removes the token when the dialog is cancelled', async () => {
      const { session, api } = createSession({
        responses: {
          'get /session': { user: null },
          'post /login': { user: { ...user } }
        }
      })
      await session.start()
      expect(api.request).not.toHaveBeenCalledWith(
        expect.objectContaining({ url: '/password-reset-confirm' })
      )
      expect(getPath()).toBe('/admin/books?page=2')
    })
  })

  describe('login()', () => {
    it('requests a password reset, and then asks to log in', async () => {
      const { session, api, notify, dialogs } = createSession({
        responses: {
          'post /password-reset': { success: true },
          'post /login': { user: { ...user } }
        },
        loginData: ['passwordReset', { username: 'tester', password: 'new' }],
        passwordResets: [{ username: 'tester' }]
      })
      expect(await session.login()).toEqual(user)
      expect(api.request).toHaveBeenCalledWith({
        method: 'post',
        url: '/password-reset',
        data: { username: 'tester' }
      })
      expect(notify).toHaveBeenCalledWith({
        type: 'info',
        text: 'If the account exists, we sent you an email.'
      })
      expect(dialogs.login).toHaveBeenCalledTimes(2)
    })

    it('asks to log in when the password reset is cancelled', async () => {
      const { session, api, notify } = createSession({
        responses: { 'post /login': { user: { ...user } } },
        loginData: ['passwordReset', { username: 'tester', password: 'x' }]
      })
      expect(await session.login()).toEqual(user)
      expect(api.request).toHaveBeenCalledOnce()
      expect(notify).not.toHaveBeenCalled()
    })

    it('asks again after failures, until it succeeds', async () => {
      let attempt = 0
      const { session, notify, dialogs } = createSession({
        responses: {
          'post /login': () => {
            if (++attempt === 1) {
              throw Object.assign(new Error('Unauthorized'), {
                response: { data: { error: 'Wrong password' } }
              })
            }
            return { user: { ...user } }
          }
        },
        loginData: [{ username: 'tester' }, { username: 'tester' }]
      })
      expect(await session.login()).toEqual(user)
      expect(dialogs.login).toHaveBeenCalledTimes(2)
      expect(notify).toHaveBeenCalledWith({
        type: 'error',
        error: 'Wrong password',
        title: 'Authentication Error',
        text: 'Wrong password'
      })
    })

    it('logs in with a passkey', async () => {
      const { session, adminContext, api } = createSession({
        responses: {
          'post /passkey-login-options': { challenge: 'challenge' },
          'post /passkey-login': { user: { ...user } }
        },
        loginData: ['passkey']
      })
      expect(await session.login()).toEqual(user)
      expect(startAuthentication).toHaveBeenCalledWith({
        optionsJSON: { challenge: 'challenge' }
      })
      expect(api.request).toHaveBeenLastCalledWith({
        method: 'post',
        url: '/passkey-login',
        data: { id: 'passkey' }
      })
      expect(adminContext.user).toEqual(user)
    })

    it('asks again quietly when the passkey prompt is cancelled', async () => {
      startAuthentication.mockRejectedValueOnce(
        Object.assign(new Error('The operation was cancelled.'), {
          name: 'NotAllowedError'
        })
      )
      const { session, notify, dialogs } = createSession({
        responses: {
          'post /passkey-login-options': { challenge: 'challenge' },
          'post /passkey-login': { user: { ...user } }
        },
        loginData: ['passkey', 'passkey']
      })
      expect(await session.login()).toEqual(user)
      expect(dialogs.login).toHaveBeenCalledTimes(2)
      expect(notify).not.toHaveBeenCalled()
    })

    describe('with TOTP', () => {
      const codeRequired = { success: false, codeRequired: true, user: null }

      const createError = (status, error) =>
        Object.assign(new Error(error), {
          response: { status, data: { error } }
        })

      it('asks for the code after the password', async () => {
        const { session, adminContext, api } = createSession({
          responses: {
            'post /login': codeRequired,
            'post /login-code': { user: { ...user } }
          },
          loginCodes: [{ code: '123456' }]
        })
        expect(await session.login()).toEqual(user)
        expect(api.request).toHaveBeenLastCalledWith({
          method: 'post',
          url: '/login-code',
          data: { code: '123456' }
        })
        expect(adminContext.user).toEqual(user)
      })

      it('asks for the code again after a wrong one', async () => {
        let attempt = 0
        const { session, notify, dialogs } = createSession({
          responses: {
            'post /login': codeRequired,
            'post /login-code': () => {
              if (++attempt === 1) {
                throw createError(401, 'Code is incorrect')
              }
              return { user: { ...user } }
            }
          },
          loginCodes: [{ code: '000000' }, { code: '123456' }]
        })
        expect(await session.login()).toEqual(user)
        expect(dialogs.login).toHaveBeenCalledOnce()
        expect(dialogs.code).toHaveBeenCalledTimes(2)
        expect(notify).toHaveBeenCalledWith(
          expect.objectContaining({ text: 'Code is incorrect' })
        )
      })

      it('asks for the password when the code is cancelled', async () => {
        const { session, notify, dialogs } = createSession({
          responses: {
            'post /login': codeRequired,
            'post /login-code': { user: { ...user } }
          },
          loginData: [{ username: 'tester' }, { username: 'tester' }],
          loginCodes: [null, { code: '123456' }]
        })
        expect(await session.login()).toEqual(user)
        expect(dialogs.login).toHaveBeenCalledTimes(2)
        expect(notify).not.toHaveBeenCalled()
      })

      it('asks for the password after too many codes or once expired', async () => {
        for (const message of [
          'Missing or expired login', 'Too many attempts'
        ]) {
          const { session, notify, dialogs } = createSession({
            responses: {
              'post /login': codeRequired,
              'post /login-code': createError(400, message)
            },
            loginData: [{ username: 'tester' }, null],
            loginCodes: [{ code: '123456' }]
          })
          expect(await session.login()).toBe(null)
          expect(dialogs.login).toHaveBeenCalledTimes(2)
          expect(dialogs.code).toHaveBeenCalledOnce()
          expect(notify).toHaveBeenCalledWith(
            expect.objectContaining({ text: message })
          )
        }
      })
    })

    it('returns `null` when the user cancels', async () => {
      const { session, api } = createSession({ loginData: [] })
      expect(await session.login()).toBe(null)
      expect(api.request).not.toHaveBeenCalled()
    })

    it('redirects after logging in if configured', async () => {
      const location = { replace: vi.fn() }
      vi.stubGlobal('location', location)
      const { session, viewRegistry } = createSession({
        responses: { 'post /login': { user: { ...user } } },
        redirectAfterLogin: '/welcome'
      })
      await session.login()
      expect(location.replace).toHaveBeenCalledWith('/welcome')
      expect(viewRegistry.resolve).not.toHaveBeenCalled()
    })
  })

  describe('logout()', () => {
    it('clears the user and the views', async () => {
      const { session, adminContext, viewRegistry } = createSession({
        responses: {
          'get /session': { user: { ...user } },
          'post /logout': { success: true }
        }
      })
      await session.start()
      expect(await session.logout()).toBe(true)
      expect(adminContext.user).toBe(null)
      expect(viewRegistry.clear).toHaveBeenCalledOnce()
    })

    it(`keeps the user when the server doesn't confirm`, async () => {
      const { session, adminContext, viewRegistry } = createSession({
        responses: {
          'get /session': { user: { ...user } },
          'post /logout': { success: false }
        }
      })
      await session.start()
      expect(await session.logout()).toBe(false)
      expect(adminContext.user).toEqual(user)
      expect(viewRegistry.clear).not.toHaveBeenCalled()
    })

    it('logs a failing logout request and keeps the user', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const error = new Error('Network down')
      const { session, adminContext } = createSession({
        responses: {
          'get /session': { user: { ...user } },
          'post /logout': error
        }
      })
      await session.start()
      expect(await session.logout()).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(error)
      expect(adminContext.user).toEqual(user)
      consoleError.mockRestore()
    })
  })

  describe('ensureUser()', () => {
    it('asks to log in once the session expired', async () => {
      let hasExpired = false
      const { session, adminContext, viewRegistry, dialogs } = createSession({
        responses: {
          'get /session': () => ({ user: hasExpired ? null : { ...user } }),
          'post /login': { user: { ...user } }
        }
      })
      await session.start()
      expect(await session.ensureUser()).toEqual(user)
      expect(dialogs.login).not.toHaveBeenCalled()
      hasExpired = true
      expect(await session.ensureUser()).toEqual(user)
      expect(viewRegistry.clear).toHaveBeenCalledOnce()
      expect(dialogs.login).toHaveBeenCalledOnce()
      expect(adminContext.user).toEqual(user)
      expect(viewRegistry.resolve).toHaveBeenCalledTimes(2)
    })
  })

  describe('global load cache', () => {
    const cachedResponse = { data: 'cached' }

    it('clears it when the user logs out', async () => {
      const { session } = createSession({
        responses: {
          'get /session': { user: { ...user } },
          'post /logout': { success: true }
        }
      })
      await session.start()
      session.loadCache.books = cachedResponse
      await session.logout()
      expect(session.loadCache).toEqual({})
    })

    it('clears it when another user logs in', async () => {
      let sessionUser = { ...user }
      const { session } = createSession({
        responses: { 'get /session': () => ({ user: { ...sessionUser } }) }
      })
      await session.start()
      session.loadCache.books = cachedResponse
      sessionUser = { id: 2, username: 'other' }
      await session.ensureUser()
      expect(session.loadCache).toEqual({})
    })

    it('keeps it when the same user is fetched again', async () => {
      const { session } = createSession({
        responses: { 'get /session': () => ({ user: { ...user } }) }
      })
      await session.start()
      session.loadCache.books = cachedResponse
      await session.ensureUser()
      expect(session.loadCache).toEqual({ books: cachedResponse })
    })
  })

  describe('fetchUser()', () => {
    it('notifies when the session request fails', async () => {
      const { session, notify } = createSession({
        responses: { 'get /session': new Error('Network down') }
      })
      expect(await session.fetchUser()).toBe(null)
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Authentication Error' })
      )
    })

    it('notifies the error of the response body', async () => {
      const error = Object.assign(new Error('Request failed'), {
        response: { data: { error: 'Session store unavailable' } }
      })
      const { session, notify } = createSession({
        responses: { 'get /session': error }
      })
      await session.fetchUser()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Session store unavailable' })
      )
    })
  })

  describe('confirmAccess()', () => {
    const success = { success: true }

    // Access is only confirmed for logged-in users:
    async function createConfirmingSession({ responses, ...options }) {
      const result = createSession({
        ...options,
        responses: { 'get /session': { user: { ...user } }, ...responses }
      })
      await result.session.start()
      return result
    }

    it('confirms the access with the password', async () => {
      const { session, api, dialogs } = await createConfirmingSession({
        responses: { 'post /confirm-access': success },
        accessConfirmations: [{ password: 'secret' }]
      })
      expect(await session.confirmAccess()).toBe(true)
      // Password managers get the username, the server only the password:
      expect(dialogs.confirmAccess.mock.calls[0][0].data).toEqual({
        username: 'tester'
      })
      expect(api.request).toHaveBeenLastCalledWith({
        method: 'post',
        url: '/confirm-access',
        data: { password: 'secret' }
      })
    })

    it('asks users with TOTP for the code after the password', async () => {
      let attempt = 0
      const { session, api, dialogs } = await createConfirmingSession({
        responses: {
          'post /confirm-access': () =>
            ++attempt === 1 ? { success: false, codeRequired: true } : success
        },
        accessConfirmations: [{ password: 'secret' }],
        loginCodes: [{ code: '123456' }]
      })
      expect(await session.confirmAccess()).toBe(true)
      expect(dialogs.code).toHaveBeenCalledOnce()
      expect(api.request).toHaveBeenLastCalledWith({
        method: 'post',
        url: '/confirm-access',
        data: { password: 'secret', code: '123456' }
      })
    })

    it('ends when the code is cancelled', async () => {
      const { session, dialogs } = await createConfirmingSession({
        responses: {
          'post /confirm-access': { success: false, codeRequired: true }
        },
        accessConfirmations: [{ password: 'secret' }, { password: 'secret' }]
      })
      expect(await session.confirmAccess()).toBe(false)
      expect(dialogs.code).toHaveBeenCalledOnce()
      expect(dialogs.confirmAccess).toHaveBeenCalledOnce()
    })

    it('confirms the access with a passkey', async () => {
      const { session, api } = await createConfirmingSession({
        responses: {
          'post /passkey-login-options': { challenge: 'challenge' },
          'post /confirm-access': success
        },
        accessConfirmations: ['passkey']
      })
      expect(await session.confirmAccess()).toBe(true)
      expect(api.request).toHaveBeenLastCalledWith({
        method: 'post',
        url: '/confirm-access',
        data: { passkey: { id: 'passkey' } }
      })
    })

    it('asks again after failures, until the user cancels', async () => {
      const { session, notify, dialogs } = await createConfirmingSession({
        responses: {
          'post /confirm-access': Object.assign(new Error('Failed'), {
            response: {
              status: 401,
              data: { message: 'Password is incorrect' }
            }
          })
        },
        accessConfirmations: [{ password: 'wrong' }]
      })
      expect(await session.confirmAccess()).toBe(false)
      expect(dialogs.confirmAccess).toHaveBeenCalledTimes(2)
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Password is incorrect' })
      )
    })
  })
})
