import { vi } from 'vitest'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { mountAdmin } from '../../packages/admin/src/test/mount.js'
import AdminUser from '../../packages/admin/src/AdminUser.js'
import { sentPasswordResets } from '../e2e/passkeys/app.ts'
import { Session } from '../e2e/passkeys/models/Session.ts'
import { User } from '../e2e/passkeys/models/User.ts'
import {
  startPasskeysApp,
  getDialog,
  waitForDialog,
  answerDialog,
  waitForNotification,
  waitOptions
} from './scenario.js'

vi.mock('@simplewebauthn/browser', async () =>
  (await import('./webauthn.js')).createWebAuthnMock()
)

const { getUrl, getAuthentication, post, logIn, setUpTotp } = startPasskeysApp()

const views = { books: { type: 'view', label: 'Books', components: {} } }

vi.setConfig({ testTimeout: 30_000 })

// Mounts the admin with the features that the server enables, and `features`
// that turn some of them off:
const mount = ({ features = {}, ...options } = {}) =>
  mountAdmin({
    views,
    server: getUrl(),
    api: { users: 'users' },
    authentication: { ...getAuthentication(), ...features },
    ...options
  })

const logInWithDialog = (admin, password = 'secret') =>
  answerDialog(admin, 'Sign In', { username: 'ada', password })

const waitForUser = admin =>
  vi.waitFor(() => {
    expect(admin.context.user?.username).toBe('ada')
    expect(admin.context.routeTree).not.toBe(null)
  }, waitOptions)

// Registers a passkey of the authenticator for `ada`, through the API:
async function registerPasskey() {
  await logIn()
  const optionsJSON = await post('passkey-options')
  await post('passkeys', await startRegistration({ optionsJSON }))
  await post('logout')
}

// Browsers with WebAuthn have `PublicKeyCredential`:
const offerPasskeys = () => vi.stubGlobal('PublicKeyCredential', class {})

describe('Session', () => {
  describe('start()', () => {
    it('resolves the views for the user of the session', async () => {
      await logIn()
      const admin = await mount()
      expect(admin.context.user).toMatchObject({ username: 'ada' })
      expect(admin.context.user).toBeInstanceOf(AdminUser)
      expect(getDialog(admin)).toBeUndefined()
    })

    it('asks to log in without a user in the session', async () => {
      const admin = await mount()
      expect(admin.context.user).toBe(null)
      await logInWithDialog(admin)
      await waitForUser(admin)
      expect(admin.context.user).toBeInstanceOf(AdminUser)
    })

    it('asks to log in again when the views fail to resolve', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      let attempt = 0
      const admin = await mount({
        // Like a dynamic import of the views that fails once:
        views: async () => {
          if (attempt++ === 0) {
            throw new Error('Unable to load the views')
          }
          return views
        }
      })
      await logInWithDialog(admin)
      await logInWithDialog(admin)
      await waitForUser(admin)
      expect(attempt).toBe(2)
      expect(consoleError).toHaveBeenCalledOnce()
    })
  })

  describe('start() with a password reset link', () => {
    // Requests the link through the API and opens it, as the email does:
    async function mountWithLink(token = null) {
      await post('password-reset', { username: 'ada' })
      const { hash } = new URL(sentPasswordResets[0])
      return mount({ path: `/${token ? `#password-reset=${token}` : hash}` })
    }

    const expectNoToken = admin => {
      expect(location.hash).toBe('')
      expect(admin.router.currentRoute.value.hash).toBe('')
    }

    it('sets the new password, and then asks to log in', async () => {
      const admin = await mountWithLink()
      const notify = vi.spyOn(admin.context, 'notify')
      await answerDialog(admin, 'Set Password', {
        password: 'changed',
        confirmation: 'changed'
      })
      await waitForNotification(notify, {
        type: 'success',
        text: 'Your password was changed. Please log in.'
      })
      await logInWithDialog(admin, 'changed')
      await waitForUser(admin)
      expectNoToken(admin)
    })

    it('notifies invalid tokens, and then asks to log in', async () => {
      const admin = await mountWithLink('invalid')
      const notify = vi.spyOn(admin.context, 'notify')
      await answerDialog(admin, 'Set Password', {
        password: 'changed',
        confirmation: 'changed'
      })
      await waitForNotification(notify, {
        type: 'error',
        text: 'Invalid or expired token'
      })
      await logInWithDialog(admin)
      await waitForUser(admin)
      expectNoToken(admin)
    })

    it('asks again with the token for invalid passwords', async () => {
      const admin = await mountWithLink()
      const notify = vi.spyOn(admin.context, 'notify')
      await answerDialog(admin, 'Set Password', {
        password: 'short',
        confirmation: 'short'
      })
      await waitForNotification(notify, {
        type: 'error',
        text: ['password must NOT have fewer than 6 characters']
      })
      await answerDialog(admin, 'Set Password', {
        password: 'changed',
        confirmation: 'changed'
      })
      await waitForNotification(notify, { type: 'success' })
      await logInWithDialog(admin, 'changed')
      await waitForUser(admin)
    })

    it('removes the token when the dialog is cancelled', async () => {
      const admin = await mountWithLink()
      await answerDialog(admin, 'Cancel')
      await logInWithDialog(admin)
      await waitForUser(admin)
      expectNoToken(admin)
    })
  })

  describe('login()', () => {
    it('requests a password reset, and then asks to log in', async () => {
      const admin = await mount()
      const notify = vi.spyOn(admin.context, 'notify')
      await answerDialog(admin, 'Forgot password?')
      await answerDialog(admin, 'Send Email', { username: 'ada' })
      await waitForNotification(notify, {
        type: 'info',
        text: 'If the account exists, we sent you an email.'
      })
      expect(sentPasswordResets).toHaveLength(1)
      await logInWithDialog(admin)
      await waitForUser(admin)
    })

    it('asks to log in when the password reset is cancelled', async () => {
      const admin = await mount()
      const notify = vi.spyOn(admin.context, 'notify')
      await answerDialog(admin, 'Forgot password?')
      await answerDialog(admin, 'Cancel')
      await logInWithDialog(admin)
      await waitForUser(admin)
      expect(sentPasswordResets).toHaveLength(0)
      expect(notify).not.toHaveBeenCalled()
    })

    it('asks again after failures, until it succeeds', async () => {
      const admin = await mount()
      const notify = vi.spyOn(admin.context, 'notify')
      await logInWithDialog(admin, 'wrong')
      await waitForNotification(notify, {
        type: 'error',
        title: 'Authentication Error',
        text: 'Password or username is incorrect'
      })
      await logInWithDialog(admin)
      await waitForUser(admin)
    })

    it('logs in with a passkey', async () => {
      offerPasskeys()
      await registerPasskey()
      const admin = await mount()
      await answerDialog(admin, 'Sign In with Passkey')
      await waitForUser(admin)
      expect(startAuthentication).toHaveBeenCalledOnce()
    })

    it('offers passkeys only with passkeys', async () => {
      offerPasskeys()
      const getButtons = admin =>
        getDialog(admin)
          .findAll('button')
          .map(button => button.text())
      expect(getButtons(await mount())).toContain('Sign In with Passkey')
      expect(
        getButtons(await mount({ features: { hasPasskeys: false } }))
      ).not.toContain('Sign In with Passkey')
    })

    it('asks again quietly when the passkey prompt is cancelled', async () => {
      offerPasskeys()
      await registerPasskey()
      startAuthentication.mockRejectedValueOnce(
        Object.assign(new Error('The operation was cancelled.'), {
          name: 'NotAllowedError'
        })
      )
      const admin = await mount()
      const notify = vi.spyOn(admin.context, 'notify')
      await answerDialog(admin, 'Sign In with Passkey')
      await answerDialog(admin, 'Sign In with Passkey')
      await waitForUser(admin)
      expect(notify).not.toHaveBeenCalled()
    })

    describe('with TOTP', () => {
      // Sets up TOTP for `ada`, and then mounts the admin to log in:
      async function mountWithTotp() {
        await logIn()
        const { totp } = await setUpTotp()
        await post('logout')
        const admin = await mount()
        const notify = vi.spyOn(admin.context, 'notify')
        return { admin, notify, code: totp.generate() }
      }

      it('asks for the code after the password', async () => {
        const { admin, code } = await mountWithTotp()
        await logInWithDialog(admin)
        await answerDialog(admin, 'Verify', { code })
        await waitForUser(admin)
      })

      it('asks for the code again after a wrong one', async () => {
        const { admin, notify, code } = await mountWithTotp()
        await logInWithDialog(admin)
        await answerDialog(admin, 'Verify', { code: '000000' })
        await waitForNotification(notify, { text: 'Code is incorrect' })
        await answerDialog(admin, 'Verify', { code })
        await waitForUser(admin)
      })

      it('asks for the password when the code is cancelled', async () => {
        const { admin, notify, code } = await mountWithTotp()
        await logInWithDialog(admin)
        await answerDialog(admin, 'Cancel')
        await logInWithDialog(admin)
        await answerDialog(admin, 'Verify', { code })
        await waitForUser(admin)
        expect(notify).not.toHaveBeenCalled()
      })

      it('asks for the password once the login expired', async () => {
        const { admin, notify, code } = await mountWithTotp()
        await logInWithDialog(admin)
        // Expire the pending login of the session, as time would:
        await vi.waitFor(async () => {
          const [session] = await Session.query()
          expect(session.value.pendingLogin).toBeDefined()
          const { value } = session
          await session.$query().patch({
            value: {
              ...value,
              pendingLogin: { ...value.pendingLogin, expires: 0 }
            }
          })
        }, waitOptions)
        await answerDialog(admin, 'Verify', { code })
        await waitForNotification(notify, { text: 'Missing or expired login' })
        await waitForDialog(admin, 'Sign In')
        expect(admin.context.user).toBe(null)
      })
    })

    it('ends when the user cancels', async () => {
      const admin = await mount()
      await answerDialog(admin, 'Cancel')
      await vi.waitFor(() =>
        expect(admin.wrapper.find('.dito-login').exists()).toBe(true)
      )
      expect(admin.context.user).toBe(null)
      expect(getDialog(admin)).toBeUndefined()
    })

    it('redirects after logging in if configured', async () => {
      const admin = await mount({
        options: { login: { redirectAfterLogin: '/welcome' } }
      })
      const replace = vi
        .spyOn(location, 'replace')
        .mockImplementation(() => {})
      await logInWithDialog(admin)
      await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/welcome'))
      expect(admin.context.routeTree).toBe(null)
    })
  })

  describe('logout()', () => {
    it('clears the user and the views', async () => {
      await logIn()
      const admin = await mount()
      expect(await admin.context.session.logout()).toBe(true)
      expect(admin.context.user).toBe(null)
      expect(admin.context.routeTree).toBe(null)
    })

    it(`keeps the user when the server doesn't confirm`, async () => {
      await logIn()
      const admin = await mount()
      // The session ended on the server, e.g. as it expired:
      await Session.query().delete()
      expect(await admin.context.session.logout()).toBe(false)
      expect(admin.context.user).toMatchObject({ username: 'ada' })
      expect(admin.context.routeTree).not.toBe(null)
    })

    it('logs a failing logout request and keeps the user', async () => {
      await logIn()
      const admin = await mount()
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      // The server can't fail like the network, so we let the request fail:
      const error = new TypeError('Failed to fetch')
      vi.spyOn(window, 'fetch').mockRejectedValueOnce(error)
      expect(await admin.context.session.logout()).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(error)
      expect(admin.context.user).toMatchObject({ username: 'ada' })
    })
  })

  describe('ensureUser()', () => {
    it('asks to log in once the session expired', async () => {
      await logIn()
      const admin = await mount()
      const { session } = admin.context
      expect(await session.ensureUser()).toMatchObject({ username: 'ada' })
      expect(getDialog(admin)).toBeUndefined()
      await Session.query().delete()
      const ensuring = session.ensureUser()
      await logInWithDialog(admin)
      expect(await ensuring).toMatchObject({ username: 'ada' })
      await waitForUser(admin)
    })
  })

  describe('global load cache', () => {
    const cachedResponse = { data: 'cached' }

    it('clears it when the user logs out', async () => {
      await logIn()
      const { context } = await mount()
      context.session.loadCache.books = cachedResponse
      await context.session.logout()
      expect(context.session.loadCache).toEqual({})
    })

    it('clears it when another user logs in', async () => {
      await logIn()
      const { context } = await mount()
      context.session.loadCache.books = cachedResponse
      await User.query().insert({ username: 'grace', password: 'secret' })
      await post('logout')
      await post('login', { username: 'grace', password: 'secret' })
      await context.session.ensureUser()
      expect(context.user).toMatchObject({ username: 'grace' })
      expect(context.session.loadCache).toEqual({})
    })

    it('keeps it when the same user is fetched again', async () => {
      await logIn()
      const { context } = await mount()
      context.session.loadCache.books = cachedResponse
      await context.session.ensureUser()
      expect(context.session.loadCache).toEqual({ books: cachedResponse })
    })
  })

  describe('fetchUser()', () => {
    it('notifies when the session request fails', async () => {
      await logIn()
      const admin = await mount()
      const notify = vi.spyOn(admin.context, 'notify')
      // The server can't fail like the network, so we let the request fail:
      vi.spyOn(window, 'fetch').mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      )
      expect(await admin.context.session.fetchUser()).toBe(null)
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Authentication Error' })
      )
    })
  })

  describe('confirmAccess()', () => {
    // Access is only confirmed for logged-in users:
    async function mountLoggedIn() {
      await logIn()
      const admin = await mount()
      const request = vi.spyOn(admin.context.api, 'request')
      const notify = vi.spyOn(admin.context, 'notify')
      return { admin, session: admin.context.session, request, notify }
    }

    const getConfirmations = request =>
      request.mock.calls
        .map(([options]) => options)
        .filter(({ url }) => url === '/users/confirm-access')
        .map(({ data }) => data)

    it('confirms the access with the password', async () => {
      const { admin, session, request } = await mountLoggedIn()
      const confirming = session.confirmAccess()
      const dialog = await answerDialog(admin, 'Confirm', {
        password: 'secret'
      })
      expect(await confirming).toBe(true)
      // Password managers get the username, the server only the password:
      expect(dialog.find('input[name="username"]').element.value).toBe('ada')
      expect(getConfirmations(request)).toEqual([{ password: 'secret' }])
    })

    it('asks users with TOTP for the code after the password', async () => {
      const { admin, session, request } = await mountLoggedIn()
      const { totp } = await setUpTotp()
      const code = totp.generate()
      const confirming = session.confirmAccess()
      await answerDialog(admin, 'Confirm', { password: 'secret' })
      await answerDialog(admin, 'Verify', { code })
      expect(await confirming).toBe(true)
      expect(getConfirmations(request)).toEqual([
        { password: 'secret' },
        { password: 'secret', code }
      ])
    })

    it('asks for the code again after a wrong one', async () => {
      const { admin, session, notify } = await mountLoggedIn()
      const { totp } = await setUpTotp()
      const confirming = session.confirmAccess()
      await answerDialog(admin, 'Confirm', { password: 'secret' })
      await answerDialog(admin, 'Verify', { code: '000000' })
      await waitForNotification(notify, { text: 'Code is incorrect' })
      await answerDialog(admin, 'Verify', { code: totp.generate() })
      expect(await confirming).toBe(true)
    })

    it('ends when the code is cancelled', async () => {
      const { admin, session } = await mountLoggedIn()
      await setUpTotp()
      const confirming = session.confirmAccess()
      await answerDialog(admin, 'Confirm', { password: 'secret' })
      await answerDialog(admin, 'Cancel')
      expect(await confirming).toBe(false)
      expect(getDialog(admin)).toBeUndefined()
    })

    it('confirms the access with a passkey', async () => {
      offerPasskeys()
      await registerPasskey()
      const { admin, session, request } = await mountLoggedIn()
      const confirming = session.confirmAccess()
      await answerDialog(admin, 'Use Passkey')
      expect(await confirming).toBe(true)
      expect(getConfirmations(request)).toEqual([
        { passkey: expect.objectContaining({ type: 'public-key' }) }
      ])
    })

    it('asks again after failures, until the user cancels', async () => {
      const { admin, session, notify } = await mountLoggedIn()
      const confirming = session.confirmAccess()
      await answerDialog(admin, 'Confirm', { password: 'wrong' })
      await waitForNotification(notify, { text: 'Password is incorrect' })
      await answerDialog(admin, 'Cancel')
      expect(await confirming).toBe(false)
    })
  })
})
