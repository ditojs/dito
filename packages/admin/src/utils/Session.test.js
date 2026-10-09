import { vi } from 'vitest'
import { Session } from './Session.js'
import DitoUser from '../DitoUser.js'
import appState from '../appState.js'

const user = { id: 1, username: 'tester' }

// Creates a session with an API that answers the `api.users` requests through
// `responses`, keyed by method and path, e.g. `'get /session'`, and with a
// view registry and a user interface that record their calls.
function createSession({
  responses = {},
  loginData = [{ username: 'tester', password: 'secret' }],
  resolvedViews = [true],
  redirectAfterLogin = null
} = {}) {
  const api = {
    users: {
      login: { method: 'post', path: 'login' },
      logout: { method: 'post', path: 'logout' },
      session: { method: 'get', path: 'session' }
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
  const session = new Session({ api, viewRegistry, redirectAfterLogin })
  const userInterface = {
    requestLoginData: vi.fn(async () => loginData.shift() ?? null),
    notify: vi.fn()
  }
  const detach = session.attachUserInterface(userInterface)
  return { session, api, viewRegistry, userInterface, detach }
}

describe('Session', () => {
  afterEach(() => {
    appState.user = null
    appState.loadCache = {}
    vi.unstubAllGlobals()
  })

  describe('start()', () => {
    it('resolves the views for the user of the session', async () => {
      const { session, viewRegistry, userInterface } = createSession({
        responses: { 'get /session': { user: { ...user } } }
      })
      await session.start()
      expect(session.user).toEqual(user)
      expect(session.user).toBeInstanceOf(DitoUser)
      expect(viewRegistry.resolve).toHaveBeenCalledOnce()
      expect(userInterface.requestLoginData).not.toHaveBeenCalled()
    })

    it('asks to log in without a user in the session', async () => {
      const { session, api, viewRegistry } = createSession({
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
      expect(session.user).toEqual(user)
      expect(viewRegistry.resolve).toHaveBeenCalledOnce()
    })

    it('asks to log in again when the views fail to resolve', async () => {
      const { session, userInterface, viewRegistry } = createSession({
        responses: {
          'get /session': { user: { ...user } },
          'post /login': { user: { ...user } }
        },
        resolvedViews: [false, true]
      })
      await session.start()
      expect(userInterface.requestLoginData).toHaveBeenCalledOnce()
      expect(viewRegistry.resolve).toHaveBeenCalledTimes(2)
    })
  })

  describe('login()', () => {
    it('asks again after failures, until it succeeds', async () => {
      let attempt = 0
      const { session, userInterface } = createSession({
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
      expect(userInterface.requestLoginData).toHaveBeenCalledTimes(2)
      expect(userInterface.notify).toHaveBeenCalledWith({
        type: 'error',
        error: 'Wrong password',
        title: 'Authentication Error',
        text: 'Wrong password'
      })
    })

    it('returns `null` when the user cancels', async () => {
      const { session, api } = createSession({ loginData: [] })
      expect(await session.login()).toBe(null)
      expect(api.request).not.toHaveBeenCalled()
    })

    it(`doesn't ask without a user interface`, async () => {
      const { session, userInterface, detach } = createSession()
      detach()
      expect(await session.login()).toBe(null)
      expect(userInterface.requestLoginData).not.toHaveBeenCalled()
    })

    it(`keeps a newer user interface when detaching an older one`, async () => {
      const { session, userInterface, detach } = createSession({
        responses: { 'post /login': { user: { ...user } } }
      })
      const newerInterface = {
        requestLoginData: vi.fn(async () => ({ username: 'tester' })),
        notify: vi.fn()
      }
      session.attachUserInterface(newerInterface)
      detach()
      expect(await session.login()).toEqual(user)
      expect(newerInterface.requestLoginData).toHaveBeenCalledOnce()
      expect(userInterface.requestLoginData).not.toHaveBeenCalled()
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
      const { session, viewRegistry } = createSession({
        responses: {
          'get /session': { user: { ...user } },
          'post /logout': { success: true }
        }
      })
      await session.start()
      await session.logout()
      expect(session.user).toBe(null)
      expect(viewRegistry.clear).toHaveBeenCalledOnce()
    })

    it(`keeps the user when the server doesn't confirm`, async () => {
      const { session, viewRegistry } = createSession({
        responses: {
          'get /session': { user: { ...user } },
          'post /logout': { success: false }
        }
      })
      await session.start()
      await session.logout()
      expect(session.user).toEqual(user)
      expect(viewRegistry.clear).not.toHaveBeenCalled()
    })

    it('logs a failing logout request and keeps the user', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const error = new Error('Network down')
      const { session } = createSession({
        responses: {
          'get /session': { user: { ...user } },
          'post /logout': error
        }
      })
      await session.start()
      await session.logout()
      expect(consoleError).toHaveBeenCalledWith(error)
      expect(session.user).toEqual(user)
      consoleError.mockRestore()
    })
  })

  describe('ensureUser()', () => {
    it('asks to log in once the session expired', async () => {
      let hasExpired = false
      const { session, viewRegistry, userInterface } = createSession({
        responses: {
          'get /session': () => ({ user: hasExpired ? null : { ...user } }),
          'post /login': { user: { ...user } }
        }
      })
      await session.start()
      await session.ensureUser()
      expect(userInterface.requestLoginData).not.toHaveBeenCalled()
      hasExpired = true
      await session.ensureUser()
      expect(viewRegistry.clear).toHaveBeenCalledOnce()
      expect(userInterface.requestLoginData).toHaveBeenCalledOnce()
      expect(session.user).toEqual(user)
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
      appState.loadCache.books = cachedResponse
      await session.logout()
      expect(appState.loadCache).toEqual({})
    })

    it('clears it when another user logs in', async () => {
      let sessionUser = { ...user }
      const { session } = createSession({
        responses: { 'get /session': () => ({ user: { ...sessionUser } }) }
      })
      await session.start()
      appState.loadCache.books = cachedResponse
      sessionUser = { id: 2, username: 'other' }
      await session.ensureUser()
      expect(appState.loadCache).toEqual({})
    })

    it('keeps it when the same user is fetched again', async () => {
      const { session } = createSession({
        responses: { 'get /session': () => ({ user: { ...user } }) }
      })
      await session.start()
      appState.loadCache.books = cachedResponse
      await session.ensureUser()
      expect(appState.loadCache).toEqual({ books: cachedResponse })
    })
  })

  describe('fetchUser()', () => {
    it('notifies when the session request fails', async () => {
      const { session, userInterface } = createSession({
        responses: { 'get /session': new Error('Network down') }
      })
      expect(await session.fetchUser()).toBe(null)
      expect(userInterface.notify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Authentication Error' })
      )
    })

    it('notifies the error of the response body', async () => {
      const error = Object.assign(new Error('Request failed'), {
        response: { data: { error: 'Session store unavailable' } }
      })
      const { session, userInterface } = createSession({
        responses: { 'get /session': error }
      })
      await session.fetchUser()
      expect(userInterface.notify).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Session store unavailable' })
      )
    })

    it('logs the error without a user interface', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const error = new Error('Network down')
      const { session, userInterface, detach } = createSession({
        responses: { 'get /session': error }
      })
      detach()
      expect(await session.fetchUser()).toBe(null)
      expect(consoleError).toHaveBeenCalledWith(error)
      expect(userInterface.notify).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })
})
