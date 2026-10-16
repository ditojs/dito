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
    // A server with passkeys, which adds and deletes them, and changes the
    // password 'secret':
    const mountWithPasskeys = async ({
      passkeys = [
        {
          id: 1,
          name: '1Password',
          createdAt: '2026-01-02T12:00:00Z',
          lastUsedAt: null
        }
      ]
    } = {}) => {
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
              name: 'Passkey',
              createdAt: '2026-01-03T12:00:00Z',
              lastUsedAt: null
            }
          ]
          return { data: passkeys.at(-1) }
        } else if (url === '/users/passkeys/1' && method === 'delete') {
          passkeys = passkeys.filter(passkey => passkey.id !== 1)
          return { data: { success: true } }
        } else if (url === '/users/password' && method === 'post') {
          if (data.currentPassword !== 'secret') {
            throw Object.assign(new Error('Request failed'), {
              response: {
                status: 400,
                data: { message: 'Password is incorrect' }
              }
            })
          }
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

    const getLastDialog = admin => admin.wrapper.findAll('.dito-dialog').at(-1)

    it('lists the passkeys of the user', async () => {
      const { getRows } = await mountWithPasskeys()
      expect(getRows()).toEqual(['1PasswordJanuary 2, 2026Never'])
    })

    it('shows a row when there are no passkeys', async () => {
      const { admin, getRows } = await mountWithPasskeys({ passkeys: [] })
      expect(getRows()).toEqual(['No passkeys yet.'])
      const cell = admin.wrapper.find('.dito-table__row--empty td')
      expect(cell.attributes('colspan')).toBe('3')
    })

    it('adds passkeys, named by the server', async () => {
      const { admin, request, getRows } = await mountWithPasskeys()
      await findButton(admin, 'Add Passkey').trigger('click')
      await flushPromises()
      expect(startRegistration).toHaveBeenCalledWith({
        optionsJSON: { challenge: 'challenge' }
      })
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/users/passkeys',
          data: { id: 'passkey' }
        })
      )
      expect(getRows()).toEqual([
        '1PasswordJanuary 2, 2026Never',
        'PasskeyJanuary 3, 2026Never'
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
      expect(startRegistration).toHaveBeenCalled()
      expect(request).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: 'post', url: '/users/passkeys' })
      )
      expect(notify).not.toHaveBeenCalled()
      expect(getRows()).toEqual(['1PasswordJanuary 2, 2026Never'])
    })

    it('deletes passkeys after asking', async () => {
      const { admin, request, getRows } = await mountWithPasskeys()
      await admin.wrapper
        .find('.dito-dialog .dito-list .dito-button--delete')
        .trigger('click')
      await flushPromises()
      expect(getLastDialog(admin).text()).toContain(
        'Do you really want to delete the 1Password passkey?'
      )
      await findButton(admin, 'Delete').trigger('click')
      await flushPromises()
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'delete', url: '/users/passkeys/1' })
      )
      expect(getRows()).toEqual(['No passkeys yet.'])
    })

    it('names unknown passkeys plainly when asking', async () => {
      const { admin } = await mountWithPasskeys({
        passkeys: [{ id: 1, name: 'Passkey', createdAt: '2026-01-02' }]
      })
      await admin.wrapper
        .find('.dito-dialog .dito-list .dito-button--delete')
        .trigger('click')
      await flushPromises()
      expect(getLastDialog(admin).text()).toContain(
        'Do you really want to delete the passkey?'
      )
    })

    describe('password', () => {
      const changePassword = async (admin, values) => {
        await findButton(admin, 'Change Password').trigger('click')
        await flushPromises()
        const dialog = getLastDialog(admin)
        for (const [name, value] of Object.entries(values)) {
          await enterValue(dialog.find(`input[name="${name}"]`), value)
        }
        await dialog.find('button[type="submit"]').trigger('click')
        await flushPromises()
        return dialog
      }

      it('asks for the current and the new password', async () => {
        const { admin } = await mountWithPasskeys()
        await findButton(admin, 'Change Password').trigger('click')
        await flushPromises()
        const dialog = getLastDialog(admin)
        const getAutocomplete = name =>
          dialog.find(`input[name="${name}"]`).attributes('autocomplete')
        expect(getAutocomplete('currentPassword')).toBe('current-password')
        expect(getAutocomplete('password')).toBe('new-password')
        expect(getAutocomplete('confirmation')).toBe('new-password')
      })

      it('changes the password', async () => {
        const { admin, request } = await mountWithPasskeys()
        const notify = vi.spyOn(admin.context, 'notify')
        await changePassword(admin, {
          currentPassword: 'secret',
          password: 'changed',
          confirmation: 'changed'
        })
        expect(request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'post',
            url: '/users/password',
            data: { currentPassword: 'secret', password: 'changed' }
          })
        )
        expect(notify).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
            text: 'Your password was changed.'
          })
        )
      })

      it(`doesn't submit a confirmation that doesn't match`, async () => {
        const { admin, request } = await mountWithPasskeys()
        const dialog = await changePassword(admin, {
          currentPassword: 'secret',
          password: 'changed',
          confirmation: 'chagned'
        })
        expect(dialog.text()).toContain('must match the new password')
        expect(request).not.toHaveBeenCalledWith(
          expect.objectContaining({ url: '/users/password' })
        )
      })

      it('reports wrong current passwords', async () => {
        const { admin } = await mountWithPasskeys()
        const notify = vi
          .spyOn(admin.context, 'notify')
          .mockImplementation(() => {})
        await changePassword(admin, {
          currentPassword: 'wrong',
          password: 'changed',
          confirmation: 'changed'
        })
        expect(notify).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' })
        )
        expect(notify).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'success' })
        )
      })
    })

    describe('with TOTP', () => {
      const backupCodes = Array.from(
        { length: 10 },
        (_, index) => `code${index}-00000`
      )

      // A server with TOTP, without passkeys, which accepts the code
      // '123456':
      const mountWithTotp = async ({ enabled = false } = {}) => {
        const createError = (status, message) =>
          Object.assign(new Error(message), {
            response: { status, data: { message } }
          })
        const checkCode = code => {
          if (code === 'expired') {
            throw createError(400, 'Missing or expired TOTP setup')
          } else if (code !== '123456') {
            throw createError(401, 'Code is incorrect')
          }
        }
        const request = vi.fn(({ method = 'get', url, data }) => {
          if (url === '/users/session') {
            return { data: { user: { id: 1, username: 'tester' } } }
          } else if (url === '/users/totp' && method === 'get') {
            return {
              data: { enabled, backupCodes: enabled ? backupCodes.length : 0 }
            }
          } else if (url === '/users/totp' && method === 'post') {
            return {
              data: {
                uri: 'otpauth://totp/Example:tester?secret=JBSWY3DPEHPK3PXP',
                secret: 'JBSWY3DPEHPK3PXP'
              }
            }
          } else if (url === '/users/totp-confirm') {
            checkCode(data.code)
            enabled = true
            return { data: { backupCodes } }
          } else if (url === '/users/totp' && method === 'delete') {
            checkCode(data.code)
            enabled = false
            return { data: { success: true } }
          }
          throw new Error(`Unexpected request: ${method} ${url}`)
        })
        const admin = await mountAdmin({
          views,
          api: { users: { path: 'users' } },
          request,
          options: { login: { totp: true } }
        })
        const { items } = await openMenu(admin)
        expect(items.map(item => item.text())).toEqual(['Security', 'Logout'])
        await items[0].trigger('click')
        await flushPromises()
        const getState = () =>
          admin.wrapper.find('.dito-dialog .dito-object').text()
        return { admin, request, getState }
      }

      const getLastDialog = admin =>
        admin.wrapper.findAll('.dito-dialog').at(-1)

      const submitCode = async (admin, code) => {
        const dialog = getLastDialog(admin)
        await enterValue(dialog.find('input[name="code"]'), code)
        await dialog.find('button[type="submit"]').trigger('click')
        await flushPromises()
      }

      it('sets up TOTP and shows the backup codes', async () => {
        const { admin, request, getState } = await mountWithTotp()
        expect(getState()).toContain('Not set up')
        await findButton(admin, 'Set Up').trigger('click')
        await flushPromises()
        const dialog = getLastDialog(admin)
        const image = dialog.find('img.dito-qr-code__image')
        expect(image.attributes('src')).toMatch(/^data:image\/svg\+xml/)
        expect(dialog.find('input[name="secret"]').element.value).toBe(
          'JBSW Y3DP EHPK 3PXP'
        )
        await submitCode(admin, '123456')
        expect(request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'post',
            url: '/users/totp-confirm',
            data: { code: '123456' }
          })
        )
        const codes = getLastDialog(admin).find('textarea').element.value
        expect(codes.split(/\s+/)).toEqual(backupCodes)
        await findButton(admin, 'Done').trigger('click')
        await flushPromises()
        expect(getState()).toContain('Enabled · 10 backup codes left')
      })

      it('asks for the code again after a wrong one', async () => {
        const { admin, getState } = await mountWithTotp()
        const notify = vi
          .spyOn(admin.context, 'notify')
          .mockImplementation(() => {})
        await findButton(admin, 'Set Up').trigger('click')
        await flushPromises()
        await submitCode(admin, '000000')
        expect(notify).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error', text: 'Code is incorrect' })
        )
        await submitCode(admin, '123456')
        await findButton(admin, 'Done').trigger('click')
        await flushPromises()
        expect(getState()).toContain('Enabled')
      })

      it('stops asking for codes when the setup expired', async () => {
        const { admin, request, getState } = await mountWithTotp()
        const notify = vi
          .spyOn(admin.context, 'notify')
          .mockImplementation(() => {})
        await findButton(admin, 'Set Up').trigger('click')
        await flushPromises()
        await submitCode(admin, 'expired')
        expect(notify).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            text: 'Missing or expired TOTP setup'
          })
        )
        // Only the Security dialog stays, as the code dialog is leaving:
        expect(
          admin.wrapper.findAll('.dito-dialog:not(.dito-dialog-leave-active)')
        ).toHaveLength(1)
        expect(
          request.mock.calls.filter(
            ([{ url }]) => url === '/users/totp-confirm'
          )
        ).toHaveLength(1)
        expect(getState()).toContain('Not set up')
      })

      it('turns off TOTP with a code', async () => {
        const { admin, request, getState } = await mountWithTotp({
          enabled: true
        })
        expect(getState()).toContain('Enabled · 10 backup codes left')
        await findButton(admin, 'Turn Off').trigger('click')
        await flushPromises()
        await submitCode(admin, '123456')
        expect(request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'delete',
            url: '/users/totp',
            data: { code: '123456' }
          })
        )
        expect(getState()).toContain('Not set up')
      })
    })
  })
})
