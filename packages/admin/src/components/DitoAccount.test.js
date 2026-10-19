import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, isForm, settle, enterValue } from '../test/mount.js'

describe('DitoAccount', () => {
  const views = { test: { type: 'view', label: 'Test', fields: {} } }

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
    expect(items.map(item => item.text())).toEqual(['Sign Out'])
    await items[0].trigger('click')
    expect(logout).toHaveBeenCalledOnce()
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it.for(['hasPasswordChange', 'hasPasskeys', 'hasTotp'])(
    'offers the Security dialog with %s',
    async name => {
      const admin = await mountAdmin({
        views,
        authentication: { [name]: true }
      })
      const { items } = await openMenu(admin)
      expect(items.map(item => item.text())).toEqual(['Security', 'Sign Out'])
    }
  )

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
              fields: {
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
      expect(items.map(item => item.text())).toEqual(['Settings', 'Sign Out'])
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
})
