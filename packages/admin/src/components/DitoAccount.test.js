import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { startRegistration } from '@simplewebauthn/browser'
import { mountAdmin, isForm, settle, enterValue } from '../test/mount.js'

// The DOM of the tests has no WebAuthn, so we answer registrations with a fixed
// response. The e2e tests run them in a browser:
vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(async () => ({ id: 'passkey' }))
}))

describe('DitoAccount', () => {
  const views = { test: { type: 'view', label: 'Test', components: {} } }

  const openMenu = async admin => {
    const account = admin.wrapper.find('.dito-account')
    const button = account.find('button[aria-haspopup="menu"]')
    await button.trigger('click')
    return { button, items: account.findAll('[role="menuitem"]') }
  }

  it('logs out through its menu', async () => {
    const admin = await mountAdmin({ views })
    await flushPromises()
    const { session } = admin.context
    const logout = vi.spyOn(session, 'logout').mockResolvedValue()
    const { button, items } = await openMenu(admin)
    expect(button.text()).toBe('tester')
    expect(items.map(item => item.text())).toEqual(['Logout'])
    await items[0].trigger('click')
    expect(logout).toHaveBeenCalledOnce()
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it(`has no account settings without the option`, async () => {
    const admin = await mountAdmin({ views })
    expect(admin.router.resolve('/account/settings').name).toBe('catch-all')
  })

  describe('account settings', () => {
    // The users resource moves the session out of the stubbed `/session`, so
    // the user can change:
    const mountWithSettings = async () => {
      let user = { id: 1, username: 'reader', email: 'reader@example.com' }
      const request = vi.fn(({ method = 'get', url, data }) => {
        if (url === '/users/session') {
          return { data: { user } }
        } else if (url === '/users/self') {
          if (method === 'patch') {
            user = { ...user, ...data }
          }
          return { data: user }
        }
        throw new Error(`Unexpected request: ${method} ${url}`)
      })
      const admin = await mountAdmin({
        views,
        api: { users: { path: 'users' } },
        request,
        options: {
          account: {
            // Like dynamic imports of the form:
            settings: async () => ({
              type: 'form',
              label: 'Account',
              components: {
                username: { type: 'text' },
                email: { type: 'email' }
              }
            })
          }
        }
      })
      await admin.navigate('/test')
      return { admin, request }
    }

    it('opens the settings of the user from the menu', async () => {
      const { admin, request } = await mountWithSettings()
      const { items } = await openMenu(admin)
      expect(items.map(item => item.text())).toEqual(['Settings', 'Logout'])
      await items[0].trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/account/settings')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'get', url: '/users/self' })
      )
      expect(form.data).toMatchObject({ username: 'reader' })
      // The view has a route, but no item in the main menu:
      const labels = admin.wrapper
        .findAll('.dito-menu__link')
        .map(link => link.text())
      expect(labels).toEqual(['Test'])
    })

    it('saves the settings and fetches the user again', async () => {
      const { admin, request } = await mountWithSettings()
      await admin.navigate('/account/settings')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      await enterValue(admin.wrapper.find('input[name="username"]'), 'editor')
      await admin.wrapper
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'patch',
          url: '/users/self',
          data: expect.objectContaining({ username: 'editor' })
        })
      )
      expect(admin.context.user.username).toBe('editor')
      expect(admin.wrapper.find('.dito-account').text()).toBe('editor')
    })
  })

  describe('security', () => {
    // A server with passkeys, which adds and deletes them:
    const mountWithPasskeys = async () => {
      let passkeys = [
        {
          id: 1,
          name: 'Laptop',
          createdAt: '2026-01-02T12:00:00Z',
          lastUsedAt: null
        }
      ]
      const request = vi.fn(({ method = 'get', url, data }) => {
        if (url === '/users/session') {
          return { data: { user: { id: 1, username: 'tester' } } }
        } else if (url === '/users/passkeys' && method === 'get') {
          return { data: passkeys }
        } else if (url === '/users/passkey-options') {
          return { data: { challenge: 'challenge' } }
        } else if (url === '/users/passkeys' && method === 'post') {
          passkeys = [
            ...passkeys,
            {
              id: 2,
              name: data.name,
              createdAt: '2026-01-03T12:00:00Z',
              lastUsedAt: null
            }
          ]
          return { data: passkeys.at(-1) }
        } else if (url === '/users/passkeys/1' && method === 'delete') {
          passkeys = passkeys.filter(passkey => passkey.id !== 1)
          return { data: { success: true } }
        }
        throw new Error(`Unexpected request: ${method} ${url}`)
      })
      const admin = await mountAdmin({
        views,
        api: { users: { path: 'users' } },
        request,
        options: { login: { passkeys: true } }
      })
      const { items } = await openMenu(admin)
      expect(items.map(item => item.text())).toEqual(['Security', 'Logout'])
      await items[0].trigger('click')
      await flushPromises()
      const getRows = () =>
        admin.wrapper
          .findAll('.dito-dialog .dito-list tbody tr')
          .map(row => row.text())
      return { admin, request, getRows }
    }

    const findButton = (admin, text) =>
      admin.wrapper.findAll('button').find(button => button.text() === text)

    it('lists the passkeys of the user', async () => {
      const { getRows } = await mountWithPasskeys()
      expect(getRows()).toEqual([
        'LaptopJanuary 2, 2026Never'
      ])
    })

    it('adds passkeys with a name', async () => {
      const { admin, request, getRows } = await mountWithPasskeys()
      await findButton(admin, 'Add Passkey').trigger('click')
      await flushPromises()
      const dialogs = admin.wrapper.findAll('.dito-dialog')
      const input = dialogs.at(-1).find('input[name="name"]')
      expect(input.attributes('autocomplete')).toBe('off')
      await enterValue(input, 'Phone')
      await dialogs.at(-1).find('button[type="submit"]').trigger('click')
      await flushPromises()
      expect(startRegistration).toHaveBeenCalledWith({
        optionsJSON: { challenge: 'challenge' }
      })
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/users/passkeys',
          data: { name: 'Phone', response: { id: 'passkey' } }
        })
      )
      expect(getRows()).toEqual([
        'LaptopJanuary 2, 2026Never',
        'PhoneJanuary 3, 2026Never'
      ])
    })

    it('stops quietly when the passkey prompt is cancelled', async () => {
      startRegistration.mockRejectedValueOnce(
        Object.assign(new Error('The operation was cancelled.'), {
          name: 'NotAllowedError'
        })
      )
      const { admin, request, getRows } = await mountWithPasskeys()
      const notify = vi.spyOn(admin.context, 'notify')
      await findButton(admin, 'Add Passkey').trigger('click')
      await flushPromises()
      const dialogs = admin.wrapper.findAll('.dito-dialog')
      await dialogs.at(-1).find('button[type="submit"]').trigger('click')
      await flushPromises()
      expect(startRegistration).toHaveBeenCalled()
      expect(request).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: 'post', url: '/users/passkeys' })
      )
      expect(notify).not.toHaveBeenCalled()
      expect(getRows()).toEqual(['LaptopJanuary 2, 2026Never'])
    })

    it('deletes passkeys after asking', async () => {
      const { admin, request, getRows } = await mountWithPasskeys()
      await admin.wrapper
        .find('.dito-dialog .dito-list .dito-button--delete')
        .trigger('click')
      await flushPromises()
      await findButton(admin, 'Delete').trigger('click')
      await flushPromises()
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'delete', url: '/users/passkeys/1' })
      )
      expect(getRows()).toEqual([])
    })
  })
})
