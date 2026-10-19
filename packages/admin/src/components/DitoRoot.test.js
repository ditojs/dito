import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { startAuthentication } from '@simplewebauthn/browser'
import appState from '../appState.js'
import DitoAdmin from '../DitoAdmin.js'
import {
  mountAdmin,
  mountForm,
  unmountAdmin,
  enterValue
} from '../test/mount.js'

// The DOM of the tests has no WebAuthn, so we answer passkey logins with a
// fixed response. The e2e tests run them in a browser:
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(async () => ({ id: 'passkey' }))
}))

// Dispatches `beforeunload` like the browser does when the page is reloaded or
// closed, and returns whether the page asks to stay.
function isUnloadPrevented() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe('DitoRoot', () => {
  describe('beforeunload', () => {
    const schema = { fields: { title: { type: 'text' } } }

    it(`doesn't prevent unloading without unsaved changes`, async () => {
      await mountForm({ schema, data: { title: 'Dune' } })
      expect(isUnloadPrevented()).toBe(false)
    })

    it('prevents unloading with unsaved changes', async () => {
      const { wrapper, settle } = await mountForm({
        schema,
        data: { title: 'Dune' }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Emma')
      await settle()
      expect(isUnloadPrevented()).toBe(true)
    })

    const editViewTitle = async buttons => {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            fields: { title: { type: 'text' } },
            buttons
          }
        }
      })
      await admin.navigate('/books')
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Emma')
      await flushPromises()
    }

    it('prevents unloading with unsaved changes in a view', async () => {
      await editViewTitle({ save: { type: 'submit' } })
      expect(isUnloadPrevented()).toBe(true)
    })

    it(`doesn't prevent unloading with edits that a view can't save`, async () => {
      await editViewTitle({ apply: { type: 'button' } })
      expect(isUnloadPrevented()).toBe(false)
    })

    it(`doesn't prevent unloading after saving`, async () => {
      const { wrapper, admin, settle, submit } = await mountForm({
        schema,
        data: { title: 'Dune' },
        request: ({ data }) => ({ data })
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Emma')
      await settle()
      expect(await submit()).toEqual({ id: 1, title: 'Emma' })
      await settle()
      expect(admin.router.currentRoute.value.path).toBe('/items')
      expect(isUnloadPrevented()).toBe(false)
    })

    it('stops listening once unmounted', async () => {
      const { wrapper, admin, settle } = await mountForm({
        schema,
        data: { title: 'Dune' }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Emma')
      await settle()
      unmountAdmin(admin)
      expect(isUnloadPrevented()).toBe(false)
    })
  })

  describe('focus', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it(`doesn't keep clicked labels in the app state`, async () => {
      const { wrapper } = await mountForm({
        schema: {
          fields: {
            details: {
              type: 'section',
              label: 'Details',
              collapsible: true,
              fields: { title: { type: 'text' } }
            }
          }
        },
        data: { title: 'Dune' }
      })
      const label = wrapper.find('button.dito-label')
      await label.trigger('click')
      await flushPromises()
      expect(label.classes()).not.toContain('dito-label--active')
      expect(appState).not.toHaveProperty('activeLabel')
    })

    it(`doesn't listen to clicks and keys on the document`, async () => {
      const addEventListener = vi.spyOn(document, 'addEventListener')
      await mountAdmin({ views: {} })
      const types = addEventListener.mock.calls.map(([type]) => type)
      expect(types).not.toContain('click')
      expect(types).not.toContain('keyup')
    })
  })

  describe('session', () => {
    it('registers the views again after logging out and in', async () => {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            label: 'Books',
            fields: { title: { type: 'text' } }
          }
        },
        request: ({ method, url, data }) =>
          method === 'post' && url === '/logout'
            ? { data: { success: true } }
            : method === 'post' && url === '/login'
              ? { data: { user: { id: 1, username: data.username } } }
              : null
      })
      const { session } = admin.context
      await admin.navigate('/books')
      await session.logout()
      await flushPromises()
      expect(admin.context.views).toEqual({})
      expect(admin.router.currentRoute.value.path).toBe('/')
      expect(admin.wrapper.find('.dito-view').exists()).toBe(false)

      await admin.wrapper.find('button.dito-login').trigger('click')
      await flushPromises()
      const dialog = admin.wrapper.find('.dito-dialog')
      await enterValue(dialog.find('input[name="username"]'), 'reader')
      await enterValue(dialog.find('input[name="password"]'), 'secret')
      await dialog.find('button[type="submit"]').trigger('click')
      await flushPromises()
      expect(admin.context.user.username).toBe('reader')
      expect(Object.keys(admin.context.views)).toEqual(['books'])
      await admin.navigate('/books')
      expect(
        admin.wrapper.find('.dito-view input[name="title"]').exists()
      ).toBe(true)
    })
  })

  describe('login dialog', () => {
    const mountLoggedOut = async authentication => {
      const request = vi.fn(({ method, url, data }) => {
        // Users named 'totp-user' have TOTP:
        const responses = {
          '/logout': { success: true },
          '/login':
            data?.username === 'totp-user'
              ? { success: false, codeRequired: true, user: null }
              : { user: { id: 1, username: data?.username } },
          '/login-code': { user: { id: 3, username: 'totp-user' } },
          '/passkey-login-options': { challenge: 'challenge' },
          '/passkey-login': { user: { id: 2, username: 'passkey-user' } },
          '/password-reset': { success: true }
        }
        return method === 'post' && url in responses
          ? { data: responses[url] }
          : null
      })
      const admin = await mountAdmin({ views: {}, request, authentication })
      await admin.context.session.logout()
      await flushPromises()
      await admin.wrapper.find('button.dito-login').trigger('click')
      await flushPromises()
      return { admin, request, dialog: admin.wrapper.find('.dito-dialog') }
    }

    // Browsers with WebAuthn have `PublicKeyCredential`:
    beforeEach(() => vi.stubGlobal('PublicKeyCredential', class {}))
    afterEach(() => vi.unstubAllGlobals())

    it('logs in with a passkey', async () => {
      const { admin, request, dialog } = await mountLoggedOut({
        hasPasskeys: true
      })
      const button = dialog
        .findAll('button')
        .find(button => button.text() === 'Sign In with Passkey')
      await button.trigger('click')
      await flushPromises()
      expect(startAuthentication).toHaveBeenCalledWith({
        optionsJSON: { challenge: 'challenge' }
      })
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/passkey-login',
          data: { id: 'passkey' }
        })
      )
      expect(admin.context.user.username).toBe('passkey-user')
    })

    it('sends no passkey with the password', async () => {
      const { admin, request, dialog } = await mountLoggedOut({
        hasPasskeys: true
      })
      await enterValue(dialog.find('input[name="username"]'), 'reader')
      await enterValue(dialog.find('input[name="password"]'), 'secret')
      await dialog.find('button[type="submit"]').trigger('click')
      await flushPromises()
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/login',
          data: { username: 'reader', password: 'secret' }
        })
      )
      expect(admin.context.user.username).toBe('reader')
    })

    describe('with TOTP', () => {
      const loginWithPassword = async () => {
        const mounted = await mountLoggedOut({})
        const { dialog } = mounted
        await enterValue(dialog.find('input[name="username"]'), 'totp-user')
        await enterValue(dialog.find('input[name="password"]'), 'secret')
        await dialog.find('button[type="submit"]').trigger('click')
        await flushPromises()
        return mounted
      }

      it('asks for the code after the password', async () => {
        const { admin, request } = await loginWithPassword()
        // The password dialog may still be leaving:
        const dialog = admin.wrapper.findAll('.dito-dialog').at(-1)
        expect(dialog.find('input[name="password"]').exists()).toBe(false)
        const input = dialog.find('input[name="code"]')
        expect(input.attributes('placeholder')).toBe('123456')
        expect(dialog.find('.dito-info').attributes('data-info')).toBe(
          'Enter the code from your authenticator app, or a backup code.'
        )
        await enterValue(input, '123456')
        // The code dialog stays visible for a second, e.g. when password
        // managers fill in and submit the code:
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
        try {
          await dialog.find('button[type="submit"]').trigger('click')
          await flushPromises()
          const isCodeSent = () =>
            request.mock.calls.some(([config]) => config.url === '/login-code')
          expect(isCodeSent()).toBe(false)
          await vi.advanceTimersByTimeAsync(1000)
        } finally {
          vi.useRealTimers()
        }
        await flushPromises()
        expect(request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'post',
            url: '/login-code',
            data: { code: '123456' }
          })
        )
        expect(admin.context.user.username).toBe('totp-user')
      })

      it('goes back to the password when the code is cancelled', async () => {
        const { admin } = await loginWithPassword()
        const cancel = admin.wrapper
          .findAll('.dito-dialog')
          .at(-1)
          .findAll('button')
          .find(button => button.text() === 'Cancel')
        await cancel.trigger('click')
        await flushPromises()
        const dialog = admin.wrapper.findAll('.dito-dialog').at(-1)
        expect(dialog.find('input[name="password"]').exists()).toBe(true)
        expect(admin.context.user).toBe(null)
      })
    })

    it('offers passkeys only when the server enables them', async () => {
      const { dialog } = await mountLoggedOut({})
      expect(dialog.text()).not.toContain('Sign In with Passkey')
    })

    it('requests a password reset, and then asks to log in', async () => {
      const { admin, request, dialog } = await mountLoggedOut({
        hasPasswordReset: true
      })
      const button = dialog
        .findAll('button')
        .find(button => button.text() === 'Forgot password?')
      await button.trigger('click')
      await flushPromises()
      // The login dialog may still be leaving:
      const reset = admin.wrapper.findAll('.dito-dialog').at(-1)
      expect(reset.find('input[name="password"]').exists()).toBe(false)
      await enterValue(reset.find('input[name="username"]'), 'reader')
      await reset.find('button[type="submit"]').trigger('click')
      await flushPromises()
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/password-reset',
          data: { username: 'reader' }
        })
      )
      expect(admin.wrapper.find('.dito-notification').text()).toContain(
        'If the account exists, we sent you an email.'
      )
      const login = admin.wrapper.findAll('.dito-dialog').at(-1)
      expect(login.find('input[name="password"]').exists()).toBe(true)
    })

    it('offers password resets only when the server enables them', async () => {
      const { dialog } = await mountLoggedOut({})
      expect(dialog.text()).not.toContain('Forgot password?')
    })
  })

  describe('showDialog()', () => {
    it('rejects when the components fail to set up', async () => {
      const admin = await mountAdmin({ views: {} })
      await expect(
        admin.context.showDialog({
          fields: {
            books: {
              type: 'list',
              form: { type: 'form', fields: {} }
            }
          }
        })
      ).rejects.toThrow('Dialogs do not support components that produce routes')
      expect(admin.root.dialogs).toEqual({})
    })

    it('rejects the keys of 3.x in buttons', async () => {
      const admin = await mountAdmin({ views: {} })
      await expect(
        admin.context.showDialog({
          fields: {},
          buttons: { confirm: { type: 'submit', data: {} } }
        })
      ).rejects.toThrow(`Unsupported schema key 'data' in 'confirm'`)
      expect(admin.root.dialogs).toEqual({})
    })

    it('makes everything behind the topmost dialog inert', async () => {
      const admin = await mountAdmin({ views: {} })
      const showDialog = () =>
        admin.context.showDialog({
          fields: {},
          buttons: { done: { type: 'submit', text: 'Done' } }
        })
      // Skip closed dialogs that are still leaving:
      const getDialogs = () =>
        admin.wrapper.findAll('.dito-dialog:not(.dito-dialog-leave-active)')
      const getInert = () => ({
        page: (
          admin.wrapper.find('.dito-page').attributes('inert') !== undefined
        ),
        dialogs: getDialogs().map(
          dialog => dialog.attributes('inert') !== undefined
        )
      })
      const closeTopDialog = async () => {
        await getDialogs().at(-1).find('form').trigger('submit')
        await flushPromises()
      }
      expect(getInert()).toEqual({ page: false, dialogs: [] })
      showDialog()
      await flushPromises()
      showDialog()
      await flushPromises()
      expect(getInert()).toEqual({ page: true, dialogs: [true, false] })
      for (const selector of ['.dito-navigation', '.dito-sidebar']) {
        expect(admin.wrapper.find(selector).attributes('inert')).toBe('')
      }
      await closeTopDialog()
      expect(getInert()).toEqual({ page: true, dialogs: [false] })
      await closeTopDialog()
      expect(getInert()).toEqual({ page: false, dialogs: [] })
    })

    it('resolves only with valid data', async () => {
      const admin = await mountAdmin({ views: {} })
      const promise = admin.context.showDialog({
        fields: { title: { type: 'text', required: true } },
        buttons: { save: { type: 'submit' } }
      })
      await flushPromises()
      const dialog = admin.wrapper.find('.dito-dialog')
      const submit = async () => {
        await dialog.find('button[type="submit"]').trigger('click')
        await flushPromises()
      }
      await submit()
      expect(dialog.find('.dito-errors').text()).toContain('required')
      await enterValue(dialog.find('input[name="title"]'), 'Emma')
      await submit()
      expect(await promise).toEqual({ title: 'Emma' })
    })
  })

  describe('session start', () => {
    it('logs the errors of setting up the views', async () => {
      const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const element = document.createElement('div')
      document.body.appendChild(element)
      const admin = new DitoAdmin(element, {
        dito: { base: '/', settings: {} },
        api: {
          url: '/',
          request: async () => ({ data: { user: { id: 1, username: 'ada' } } })
        },
        // Views need to be of type 'view':
        views: { books: { type: 'form', fields: {} } }
      })
      try {
        await vi.waitFor(() => {
          expect(logError).toHaveBeenCalledWith(
            expect.objectContaining({
              message: expect.stringMatching(/^Invalid view schema: /)
            })
          )
        })
        await flushPromises()
        expect(element.querySelector('.dito-account').textContent).toBe('ada')
      } finally {
        admin.app.unmount()
        element.remove()
        vi.restoreAllMocks()
      }
    })
  })

  describe('header', () => {
    const mountLoadingAdmin = async options => {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            field: {
              type: 'list',
              resource: { path: 'books' },
              columns: { title: {} }
            }
          }
        },
        // Keep loading the list:
        request: () => new Promise(() => {}),
        options
      })
      admin.navigate('/books')
      await flushPromises()
      return admin.wrapper.find('.dito-header')
    }

    it('shows a spinner while loading', async () => {
      const header = await mountLoadingAdmin()
      expect(header.attributes('aria-busy')).toBe('true')
      expect(header.find('.dito-spinner').exists()).toBe(true)
    })

    it(`doesn't show the spinner with \`spinner: null\``, async () => {
      const header = await mountLoadingAdmin({ spinner: null })
      expect(header.attributes('aria-busy')).toBe('true')
      expect(header.find('.dito-spinner').exists()).toBe(false)
    })
  })

  describe('info tooltips', () => {
    // Hovers the info of the `title` field and returns its tooltip:
    async function showInfoTooltip(info) {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            fields: { title: { type: 'text', info } }
          }
        }
      })
      await admin.navigate('/books')
      const element = admin.element.querySelector('.dito-info')
      element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
      element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      await vi.advanceTimersByTimeAsync(500)
      return document.querySelector('[data-tippy-root]')
    }

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows the info of labels in a tooltip in their pane', async () => {
      const tooltip = await showInfoTooltip('The title on the cover')
      expect(tooltip.textContent).toBe('The title on the cover')
      expect(tooltip.parentElement.closest('.dito-pane')).not.toBe(null)
    })

    it('shows text info as text, with its line breaks', async () => {
      const tooltip = await showInfoTooltip('Cover & <b>spine</b>\nOr back')
      expect(tooltip.textContent).toBe('Cover & <b>spine</b>\nOr back')
      expect(tooltip.querySelector('b')).toBe(null)
    })

    it('renders the HTML of `{ html }` info', async () => {
      const tooltip = await showInfoTooltip({ html: 'The <b>cover</b>' })
      expect(tooltip.querySelector('b').textContent).toBe('cover')
      expect(tooltip.textContent).toBe('The cover')
    })
  })
})
