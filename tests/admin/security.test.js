import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { startRegistration } from '@simplewebauthn/browser'
import { TOTP } from 'otpauth'
import { mountAdmin } from '../../packages/admin/src/test/mount.js'
import { Credential } from '../e2e/passkeys/models/Credential.ts'
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

vi.setConfig({ testTimeout: 30_000 })

const views = { books: { type: 'view', label: 'Books', fields: {} } }

// Logs in `ada`, runs `setUp()`, and opens the Security dialog from the account
// menu, with the features that the server enables, and `features` that turn
// some of them off. Waits until the dialog loaded the passkeys and the TOTP.
// Requests and notifications are observed through `request` and `notify`:
async function openSecurity({ features = {}, setUp = null } = {}) {
  await logIn()
  await setUp?.()
  const authentication = { ...getAuthentication(), ...features }
  const admin = await mountAdmin({
    views,
    server: getUrl(),
    api: { users: 'users' },
    authentication
  })
  const request = vi.spyOn(admin.context.api, 'request')
  const notify = vi.spyOn(admin.context, 'notify')
  const account = admin.wrapper.find('.dito-account')
  await account.find('button[aria-haspopup="menu"]').trigger('click')
  const items = account.findAll('[role="menuitem"]')
  expect(items.map(item => item.text())).toEqual(['Security', 'Sign Out'])
  await items[0].trigger('click')
  const security = await vi.waitFor(() => {
    const dialog = getDialog(admin)
    expect(dialog?.attributes('aria-label')).toBe('Security')
    if (authentication.hasPasskeys) {
      expect(getRows(admin).length).toBeGreaterThan(0)
    }
    if (authentication.hasTotp) {
      expect(getState(admin)).not.toBe('')
    }
    return dialog
  }, waitOptions)
  return { admin, security, request, notify }
}

const getState = admin =>
  admin.wrapper
    .find('.dito-dialog .dito-object[id$="totp"] .dito-object__content')
    .text()

const getRows = admin =>
  admin.wrapper
    .findAll('.dito-dialog .dito-list tbody tr')
    .map(row => row.text())

const findButton = (admin, text) =>
  admin.wrapper.findAll('button').find(button => button.text() === text)

const getRequests = (request, method, url) =>
  request.mock.calls.filter(
    ([options]) => (options.method ?? 'get') === method && options.url === url
  )

// Passkeys with fixed dates, to compare the rows:
async function addPasskeys(names = ['1Password']) {
  const user = await User.query().findOne({ username: 'ada' })
  for (const [index, name] of names.entries()) {
    const { id } = await Credential.query().insert({
      name,
      type: 'passkey',
      userModel: 'User',
      userId: `${user.id}`,
      key: `key-${index}`,
      data: {}
    })
    // The server sets `createdAt` on insert:
    await Credential.query()
      .findById(id)
      .patch({ createdAt: '2026-01-02T12:00:00Z' })
  }
}

// Let the access that the login confirmed expire, as time would:
async function expireConfirmedAccess() {
  for (const session of await Session.query()) {
    const { value } = session
    if (value.confirmedAccess) {
      await session.$query().patch({
        value: {
          ...value,
          confirmedAccess: { ...value.confirmedAccess, expires: 0 }
        }
      })
    }
  }
}

const confirmAccess = (admin, password) =>
  answerDialog(admin, 'Confirm', { password })

describe('Security dialog', () => {
  describe('passkeys', () => {
    it('lists the passkeys of the user', async () => {
      await addPasskeys()
      const { admin } = await openSecurity()
      await vi.waitFor(() =>
        expect(getRows(admin)).toEqual(['1PasswordJanuary 2, 2026Never'])
      )
    })

    it('shows a row when there are no passkeys', async () => {
      const { admin } = await openSecurity()
      await vi.waitFor(() =>
        expect(getRows(admin)).toEqual(['No passkeys yet.'])
      )
      const cell = admin.wrapper.find('.dito-table__row--empty td')
      expect(cell.attributes('colspan')).toBe('3')
    })

    it('adds passkeys, named by the server', async () => {
      await addPasskeys()
      const { admin } = await openSecurity()
      await vi.waitFor(() => expect(getRows(admin)).toHaveLength(1))
      await findButton(admin, 'Add Passkey').trigger('click')
      await vi.waitFor(
        () => expect(getRows(admin)).toHaveLength(2),
        waitOptions
      )
      expect(startRegistration).toHaveBeenCalledOnce()
      expect(getRows(admin)[1]).toMatch(/^Passkey.*Never$/)
      expect(await Credential.query().where('type', 'passkey')).toHaveLength(2)
    })

    it('stops quietly when the passkey prompt is cancelled', async () => {
      startRegistration.mockRejectedValueOnce(
        Object.assign(new Error('The operation was cancelled.'), {
          name: 'NotAllowedError'
        })
      )
      const { admin, request, notify } = await openSecurity()
      await findButton(admin, 'Add Passkey').trigger('click')
      await vi.waitFor(() => expect(startRegistration).toHaveBeenCalled())
      await flushPromises()
      expect(getRequests(request, 'post', '/users/passkeys')).toHaveLength(0)
      expect(notify).not.toHaveBeenCalled()
      expect(getRows(admin)).toEqual(['No passkeys yet.'])
    })

    it('deletes passkeys after asking', async () => {
      await addPasskeys()
      const { admin } = await openSecurity()
      await vi.waitFor(() => expect(getRows(admin)).toHaveLength(1))
      await admin.wrapper
        .find('.dito-dialog .dito-list .dito-button--delete')
        .trigger('click')
      const dialog = await answerDialog(admin, 'Delete')
      expect(dialog.text()).toContain(
        'Do you really want to delete the 1Password passkey?'
      )
      await vi.waitFor(
        () => expect(getRows(admin)).toEqual(['No passkeys yet.']),
        waitOptions
      )
      expect(await Credential.query()).toEqual([])
    })

    it('names unknown passkeys plainly when asking', async () => {
      await addPasskeys(['Passkey'])
      const { admin } = await openSecurity()
      await vi.waitFor(() => expect(getRows(admin)).toHaveLength(1))
      await admin.wrapper
        .find('.dito-dialog .dito-list .dito-button--delete')
        .trigger('click')
      const dialog = await waitForDialog(admin, 'Delete')
      expect(dialog.text()).toContain(
        'Do you really want to delete the passkey?'
      )
    })
  })

  describe('confirmed access', () => {
    it('confirms the access, and then adds the passkey', async () => {
      const { admin, request } = await openSecurity()
      await expireConfirmedAccess()
      await findButton(admin, 'Add Passkey').trigger('click')
      await confirmAccess(admin, 'secret')
      await vi.waitFor(
        () =>
          expect(getRows(admin)).toEqual([expect.stringMatching(/^Passkey/)]),
        waitOptions
      )
      // The request that answered `confirmationRequired` is sent again:
      expect(
        getRequests(request, 'post', '/users/passkey-options')
      ).toHaveLength(2)
    })

    it('asks again after a wrong password', async () => {
      const { admin, notify } = await openSecurity()
      await expireConfirmedAccess()
      await findButton(admin, 'Add Passkey').trigger('click')
      await confirmAccess(admin, 'wrong')
      await waitForNotification(notify, { text: 'Password is incorrect' })
      await confirmAccess(admin, 'secret')
      await vi.waitFor(
        () =>
          expect(getRows(admin)).toEqual([expect.stringMatching(/^Passkey/)]),
        waitOptions
      )
    })

    it('confirms the access, and then deletes the passkey', async () => {
      await addPasskeys()
      const { admin } = await openSecurity()
      await vi.waitFor(() => expect(getRows(admin)).toHaveLength(1))
      await expireConfirmedAccess()
      await admin.wrapper
        .find('.dito-dialog .dito-list .dito-button--delete')
        .trigger('click')
      await answerDialog(admin, 'Delete')
      await confirmAccess(admin, 'secret')
      await vi.waitFor(
        () => expect(getRows(admin)).toEqual(['No passkeys yet.']),
        waitOptions
      )
    })

    it('stops quietly when the confirmation is cancelled', async () => {
      const { admin, request, notify } = await openSecurity()
      await expireConfirmedAccess()
      await findButton(admin, 'Add Passkey').trigger('click')
      await waitForDialog(admin, 'Confirm')
      await answerDialog(admin, 'Cancel')
      // A button without its own error handling:
      await findButton(admin, 'Change').trigger('click')
      await answerDialog(admin, 'Change Password', {
        password: 'changed',
        confirmation: 'changed'
      })
      await waitForDialog(admin, 'Confirm')
      await answerDialog(admin, 'Cancel')
      await vi.waitFor(() =>
        expect(getDialog(admin).text()).toContain('Passkeys')
      )
      expect(notify).not.toHaveBeenCalled()
      expect(startRegistration).not.toHaveBeenCalled()
      expect(
        getRequests(request, 'post', '/users/confirm-access')
      ).toHaveLength(
        0
      )
      expect(getRows(admin)).toEqual(['No passkeys yet.'])
    })
  })

  describe('password', () => {
    const changePassword = (admin, values) =>
      findButton(admin, 'Change')
        .trigger('click')
        .then(() => answerDialog(admin, 'Change Password', values))

    // The changed password logs in, after the change ended the session:
    const expectPassword = async password => {
      await post('logout')
      await expect(
        post('login', { username: 'ada', password })
      ).resolves.toMatchObject({ success: true })
    }

    it('changes the password', async () => {
      const { admin, request, notify } = await openSecurity()
      await changePassword(admin, {
        password: 'changed',
        confirmation: 'changed'
      })
      await waitForNotification(notify, {
        type: 'success',
        text: 'Your password was changed.'
      })
      expect(getRequests(request, 'post', '/users/password')).toEqual([
        [expect.objectContaining({ data: { password: 'changed' } })]
      ])
      await expectPassword('changed')
    })

    it('changes the password without passkeys or TOTP', async () => {
      const { admin, security, request, notify } = await openSecurity({
        features: { hasPasskeys: false, hasTotp: false }
      })
      expect(security.find('input[name="password"]').exists()).toBe(true)
      expect(security.find('.dito-list').exists()).toBe(false)
      await expireConfirmedAccess()
      await changePassword(admin, {
        password: 'changed',
        confirmation: 'changed'
      })
      await confirmAccess(admin, 'secret')
      await waitForNotification(notify, {
        type: 'success',
        text: 'Your password was changed.'
      })
      expect(getRequests(request, 'post', '/users/password')).toHaveLength(2)
      await expectPassword('changed')
    })

    it.for([true, false])(
      'offers passkeys to confirm the access only with passkeys: %s',
      async hasPasskeys => {
        // Browsers with WebAuthn have `PublicKeyCredential`:
        vi.stubGlobal('PublicKeyCredential', class {})
        const { admin } = await openSecurity({
          features: { hasPasskeys }
        })
        await expireConfirmedAccess()
        await changePassword(admin, {
          password: 'changed',
          confirmation: 'changed'
        })
        const dialog = await waitForDialog(admin, 'Confirm')
        expect(dialog.attributes('aria-label')).toBe('Confirm Access')
        expect(dialog.text().includes('Use Passkey')).toBe(hasPasskeys)
      }
    )

    it(`isn't shown without the password change`, async () => {
      const { admin, security } = await openSecurity({
        features: { hasPasswordChange: false }
      })
      expect(security.find('input[name="password"]').exists()).toBe(false)
      expect(findButton(admin, 'Change')).toBeUndefined()
    })

    it('shows a placeholder instead of the password', async () => {
      const { security } = await openSecurity()
      const input = security.find('input[name="password"]')
      expect(input.element.value).toBe('')
      expect(input.attributes('placeholder')).toBe('••••••••')
      expect(input.attributes('disabled')).toBeDefined()
    })

    it('asks for the new password only', async () => {
      const { admin } = await openSecurity()
      await findButton(admin, 'Change').trigger('click')
      const dialog = await waitForDialog(admin, 'Change Password')
      const getAutocomplete = name =>
        dialog.find(`input[name="${name}"]`).attributes('autocomplete')
      expect(dialog.findAll('input[type="password"]')).toHaveLength(2)
      expect(getAutocomplete('password')).toBe('new-password')
      expect(getAutocomplete('confirmation')).toBe('new-password')
    })

    it(`doesn't submit a confirmation that doesn't match`, async () => {
      const { admin, request } = await openSecurity()
      const dialog = await changePassword(admin, {
        password: 'changed',
        confirmation: 'chagned'
      })
      expect(dialog.text()).toContain('must match the new password')
      expect(getRequests(request, 'post', '/users/password')).toHaveLength(0)
    })

    it('lists the errors of invalid passwords, and asks again', async () => {
      const { admin, notify } = await openSecurity()
      await changePassword(admin, { password: 'short', confirmation: 'short' })
      await waitForNotification(notify, {
        type: 'error',
        title: 'Invalid Password',
        text: ['password must be at least 6 characters long']
      })
      expect(notify).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' })
      )
      await answerDialog(admin, 'Change Password', {
        password: 'changed',
        confirmation: 'changed'
      })
      await waitForNotification(notify, { type: 'success' })
      await expectPassword('changed')
    })
  })

  describe('with TOTP', () => {
    // Opens the setup, and returns the TOTP of the key that it shows:
    async function openSetup(admin) {
      await vi.waitFor(() => expect(getState(admin)).toContain('Not set up'))
      await findButton(admin, 'Set Up').trigger('click')
      const dialog = await waitForDialog(admin, 'Turn On')
      const secret = dialog.find('input[name="secret"]').element.value
      return { dialog, totp: new TOTP({ secret: secret.replaceAll(' ', '') }) }
    }

    it('sets up TOTP and shows the backup codes', async () => {
      const { admin } = await openSecurity()
      const { dialog, totp } = await openSetup(admin)
      const image = dialog.find('img.dito-qr-code__image')
      expect(image.attributes('src')).toMatch(/^data:image\/svg\+xml/)
      // The key is grouped for reading:
      expect(dialog.find('input[name="secret"]').element.value).toMatch(
        /^(\w{4} )+\w{1,4}$/
      )
      await answerDialog(admin, 'Turn On', { code: totp.generate() })
      const codes = await waitForDialog(admin, 'Done')
      const backupCodes = codes.find('textarea').element.value.split(/\s+/)
      expect(backupCodes).toHaveLength(10)
      await answerDialog(admin, 'Done')
      await vi.waitFor(
        () =>
          expect(getState(admin)).toContain('Enabled · 10 backup codes left'),
        waitOptions
      )
    })

    it('asks for the code again after a wrong one', async () => {
      const { admin, notify } = await openSecurity()
      const { totp } = await openSetup(admin)
      await answerDialog(admin, 'Turn On', { code: '000000' })
      await waitForNotification(notify, {
        type: 'error',
        text: 'Code is incorrect'
      })
      await answerDialog(admin, 'Turn On', { code: totp.generate() })
      await answerDialog(admin, 'Done')
      await vi.waitFor(() => expect(getState(admin)).toContain('Enabled'))
    })

    it('stops asking for codes when the setup expired', async () => {
      const { admin, request, notify } = await openSecurity()
      const { totp } = await openSetup(admin)
      // A new login starts a new session, without the setup:
      await post('logout')
      await logIn()
      await answerDialog(admin, 'Turn On', { code: totp.generate() })
      await waitForNotification(notify, { type: 'error' })
      // Only the Security dialog stays:
      await vi.waitFor(() =>
        expect(getDialog(admin).attributes('aria-label')).toBe('Security')
      )
      expect(getRequests(request, 'post', '/users/totp-confirm')).toHaveLength(
        1
      )
      expect(getState(admin)).toContain('Not set up')
    })

    it('stops quietly when the confirmation is cancelled', async () => {
      const { admin, request, notify } = await openSecurity()
      const { totp } = await openSetup(admin)
      await expireConfirmedAccess()
      await answerDialog(admin, 'Turn On', { code: totp.generate() })
      await waitForDialog(admin, 'Confirm')
      await answerDialog(admin, 'Cancel')
      await vi.waitFor(() =>
        expect(getDialog(admin).attributes('aria-label')).toBe('Security')
      )
      expect(notify).not.toHaveBeenCalled()
      expect(getRequests(request, 'post', '/users/totp-confirm')).toHaveLength(
        1
      )
      expect(getState(admin)).toContain('Not set up')
    })

    it('turns off TOTP after asking, without a code', async () => {
      const { admin } = await openSecurity({ setUp: setUpTotp })
      await vi.waitFor(() =>
        expect(getState(admin)).toContain('Enabled · 10 backup codes left')
      )
      await findButton(admin, 'Turn Off').trigger('click')
      const dialog = await vi.waitFor(() => {
        const dialog = getDialog(admin)
        expect(dialog.text()).toContain(
          'Do you really want to turn off two-factor authentication?'
        )
        return dialog
      })
      expect(dialog.find('input[name="code"]').exists()).toBe(false)
      await answerDialog(admin, 'Turn Off')
      await vi.waitFor(() => expect(getState(admin)).toContain('Not set up'))
      expect(await Credential.query()).toEqual([])
    })
  })
})
