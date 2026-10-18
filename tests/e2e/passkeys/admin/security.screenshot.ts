import type { Locator, Page } from '@playwright/test'
import { TOTP } from 'otpauth'
import { test, expect } from '../fixtures.js'
import { expectScreenshot, phone } from '../../screenshots/scenes.js'
import { Credential } from '../models/Credential.js'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'

// Screenshots of the login and Security dialogs, compared against the
// baselines in `__screenshots__`, see `pnpm -C tests screenshots`.

async function login(page: Page, url: string) {
  await page.goto(`${url}/admin/`)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Username').fill('ada')
  await dialog.getByLabel('Password').fill('secret')
  await dialog.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.locator('.dito-account')).toHaveText('ada')
}

async function openSecurity(page: Page) {
  await page.locator('.dito-account').getByRole('button').click()
  await page.getByRole('menuitem', { name: 'Security' }).click()
  const dialog = page.getByRole('dialog', { name: 'Security' })
  await expect(
    dialog.getByRole('button', { name: 'Add Passkey' })
  ).toBeVisible()
  return dialog
}

// Passkeys with fixed dates, so that the screenshots stay the same:
async function addPasskeys() {
  const user = await User.query().findOne({ username: 'ada' })
  const passkeys = [
    { name: '1Password', createdAt: '2026-03-02', lastUsedAt: '2026-05-14' },
    { name: 'iCloud Keychain', createdAt: '2026-04-20', lastUsedAt: null }
  ]
  for (const [index, { createdAt, ...passkey }] of passkeys.entries()) {
    const { id } = await Credential.query().insert({
      ...passkey,
      type: 'passkey',
      userModel: 'User',
      userId: `${user!.id}`,
      key: `key-${index}`,
      data: {}
    } as any)
    // The server sets `createdAt` on insert:
    await Credential.query()
      .findById(id)
      .patch({ createdAt } as any)
  }
}

// TOTP with all backup codes left. The login and the security dialog only check
// that the credential exists, and count its backup codes:
async function addTotp() {
  const user = await User.query().findOne({ username: 'ada' })
  await Credential.query().insert({
    type: 'totp',
    userModel: 'User',
    userId: `${user!.id}`,
    data: { backupCodes: Array(10).fill('') }
  } as any)
}

// Opens the setup, and returns its dialog and the TOTP of the key that it
// shows:
async function openTotpSetup(page: Page, url: string) {
  await login(page, url)
  const security = await openSecurity(page)
  await security.getByRole('button', { name: 'Set Up' }).click()
  const dialog = page.getByRole('dialog', {
    name: 'Set Up Two-Factor Authentication'
  })
  await expect(dialog.getByRole('img', { name: 'QR code' })).toBeVisible()
  const secret = await dialog.getByLabel('Or enter the key').inputValue()
  return { dialog, totp: new TOTP({ secret: secret.replaceAll(' ', '') }) }
}

// The server creates a random key for each setup, and random backup codes, so
// we mask them for screenshots that stay the same:
const getTotpMask = (dialog: Locator) => [
  dialog.getByRole('img', { name: 'QR code' }),
  dialog.getByRole('textbox', { name: 'Or enter the key' })
]

test.describe('screenshots', () => {
  test('login dialog with passkeys', async ({ page, url }) => {
    await page.goto(`${url}/admin/`)
    await expect(
      page.getByRole('button', { name: 'Sign In with Passkey' })
    ).toBeVisible()
    await expectScreenshot(page, 'login-passkeys.png')
  })

  test('password reset dialog', async ({ page, url }) => {
    await page.goto(`${url}/admin/`)
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    const dialog = page.getByRole('dialog', { name: 'Reset Password' })
    await expect(dialog.getByLabel('Username')).toBeFocused()
    await expectScreenshot(page, 'password-reset.png')
  })

  test('set new password dialog', async ({ page, url }) => {
    await page.goto(`${url}/admin/#password-reset=token`)
    const dialog = page.getByRole('dialog', { name: 'Set New Password' })
    await expect(
      dialog.getByLabel('New Password', { exact: true })
    ).toBeFocused()
    await expectScreenshot(page, 'password-reset-confirm.png')
  })

  test('security dialog without passkeys', async ({ page, url }) => {
    await login(page, url)
    const dialog = await openSecurity(page)
    await expect(dialog.locator('tbody tr')).toHaveText('No passkeys yet.')
    await expectScreenshot(page, 'security-empty.png')
  })

  test('security dialog with passkeys', async ({ page, url }) => {
    await addPasskeys()
    await login(page, url)
    const dialog = await openSecurity(page)
    await expect(dialog.locator('tbody tr')).toHaveCount(2)
    await expectScreenshot(page, 'security-passkeys.png')
  })

  test('delete passkey confirmation', async ({ page, url }) => {
    await addPasskeys()
    await login(page, url)
    const security = await openSecurity(page)
    await security.getByRole('button', { name: 'Delete' }).first().click()
    await expect(
      page.getByRole('dialog', {
        name: 'Do you really want to delete the 1Password passkey?'
      })
    ).toBeVisible()
    await expectScreenshot(page, 'delete-passkey.png')
  })

  test('change password dialog', async ({ page, url }) => {
    await login(page, url)
    const security = await openSecurity(page)
    await security.getByRole('button', { name: 'Change', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Change Password' })
    await expect(
      dialog.getByLabel('New Password', { exact: true })
    ).toBeFocused()
    await expectScreenshot(page, 'change-password.png')
  })

  test('invalid password notification above the dialog', async ({
    page,
    url
  }) => {
    await login(page, url)
    const security = await openSecurity(page)
    await security.getByRole('button', { name: 'Change', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Change Password' })
    await dialog.getByLabel('New Password', { exact: true }).fill('short')
    await dialog.getByLabel('Confirm New Password').fill('short')
    await dialog.getByRole('button', { name: 'Change Password' }).click()
    await expect(page.locator('.dito-notification')).toContainText(
      'password must NOT have fewer than 6 characters'
    )
    // The dialog asks again, once the submitted one has left:
    await expect(dialog).toHaveCount(1)
    await expect(
      dialog.getByLabel('New Password', { exact: true })
    ).toBeFocused()
    await expectScreenshot(page, 'change-password-invalid.png')
  })

  test('login code dialog', async ({ page, url }) => {
    await addTotp()
    await page.goto(`${url}/admin/`)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Username').fill('ada')
    await dialog.getByLabel('Password').fill('secret')
    await dialog.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(dialog.getByLabel('Authentication Code')).toBeFocused()
    await expectScreenshot(page, 'login-code.png')
  })

  test('security dialog with TOTP', async ({ page, url }) => {
    await login(page, url)
    await addTotp()
    const dialog = await openSecurity(page)
    await expect(dialog).toContainText('Enabled · 10 backup codes left')
    await expectScreenshot(page, 'security-totp.png')
  })

  test('TOTP setup dialog', async ({ page, url }) => {
    const { dialog } = await openTotpSetup(page, url)
    await expect(dialog.getByLabel('Authentication Code')).toBeFocused()
    await expectScreenshot(page, 'totp-setup.png', {
      mask: getTotpMask(dialog)
    })
  })

  test('backup codes dialog', async ({ page, url }) => {
    const { dialog: setup, totp } = await openTotpSetup(page, url)
    await setup.getByLabel('Authentication Code').fill(totp.generate())
    await setup.getByRole('button', { name: 'Turn On' }).click()
    const dialog = page.getByRole('dialog', { name: 'Backup Codes' })
    await expect(dialog.getByRole('textbox')).toHaveValue(/^\w{5}-\w{5}/)
    await expectScreenshot(page, 'totp-backup-codes.png', {
      mask: [dialog.getByRole('textbox')]
    })
  })

  test('turn off TOTP dialog', async ({ page, url }) => {
    await login(page, url)
    await addTotp()
    const security = await openSecurity(page)
    await security.getByRole('button', { name: 'Turn Off' }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Do you really want to turn off two-factor authentication?'
    })
    await expect(dialog.getByRole('button', { name: 'Turn Off' })).toBeVisible()
    await expectScreenshot(page, 'totp-turn-off.png')
  })
})

test.describe('phone screenshots', () => {
  test.use(phone)

  test('login dialog', async ({ page, url }) => {
    await page.goto(`${url}/admin/`)
    await expect(
      page.getByRole('button', { name: 'Sign In with Passkey' })
    ).toBeVisible()
    await expectScreenshot(page, 'phone-login.png')
  })

  test('login code dialog', async ({ page, url }) => {
    await addTotp()
    await page.goto(`${url}/admin/`)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Username').fill('ada')
    await dialog.getByLabel('Password').fill('secret')
    await dialog.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(dialog.getByLabel('Authentication Code')).toBeFocused()
    await expectScreenshot(page, 'phone-login-code.png')
  })

  test('password reset dialog', async ({ page, url }) => {
    await page.goto(`${url}/admin/`)
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    const dialog = page.getByRole('dialog', { name: 'Reset Password' })
    await expect(dialog.getByLabel('Username')).toBeFocused()
    await expectScreenshot(page, 'phone-password-reset.png')
  })

  test('set new password dialog', async ({ page, url }) => {
    await page.goto(`${url}/admin/#password-reset=token`)
    const dialog = page.getByRole('dialog', { name: 'Set New Password' })
    await expect(
      dialog.getByLabel('New Password', { exact: true })
    ).toBeFocused()
    await expectScreenshot(page, 'phone-password-reset-confirm.png')
  })

  test('security dialog', async ({ page, url }) => {
    await addPasskeys()
    await login(page, url)
    await addTotp()
    const dialog = await openSecurity(page)
    await expect(dialog.locator('tbody tr')).toHaveCount(2)
    await expectScreenshot(page, 'phone-security.png')
  })

  test('confirm access dialog', async ({ page, url }) => {
    await login(page, url)
    const security = await openSecurity(page)
    // Let the access that the login confirmed expire, as time would:
    const [session] = await Session.query()
    const { value } = session as any
    await session.$query().patch({
      value: {
        ...value,
        confirmedAccess: { ...value.confirmedAccess, expires: 0 }
      }
    } as any)
    await security.getByRole('button', { name: 'Set Up' }).click()
    const dialog = page.getByRole('dialog', { name: 'Confirm Access' })
    await expect(dialog.getByLabel('Password')).toBeFocused()
    await expectScreenshot(page, 'phone-confirm-access.png')
  })

  test('change password dialog', async ({ page, url }) => {
    await login(page, url)
    const security = await openSecurity(page)
    await security.getByRole('button', { name: 'Change', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Change Password' })
    await expect(
      dialog.getByLabel('New Password', { exact: true })
    ).toBeFocused()
    await expectScreenshot(page, 'phone-change-password.png')
  })

  test('delete passkey confirmation', async ({ page, url }) => {
    await addPasskeys()
    await login(page, url)
    const security = await openSecurity(page)
    await security.getByRole('button', { name: 'Delete' }).first().click()
    await expect(
      page.getByRole('dialog', {
        name: 'Do you really want to delete the 1Password passkey?'
      })
    ).toBeVisible()
    await expectScreenshot(page, 'phone-delete-passkey.png')
  })

  test('TOTP setup dialog', async ({ page, url }) => {
    const { dialog } = await openTotpSetup(page, url)
    await expect(dialog.getByLabel('Authentication Code')).toBeFocused()
    await expectScreenshot(page, 'phone-totp-setup.png', {
      mask: getTotpMask(dialog)
    })
  })

  test('backup codes dialog', async ({ page, url }) => {
    const { dialog: setup, totp } = await openTotpSetup(page, url)
    await setup.getByLabel('Authentication Code').fill(totp.generate())
    await setup.getByRole('button', { name: 'Turn On' }).click()
    const dialog = page.getByRole('dialog', { name: 'Backup Codes' })
    await expect(dialog.getByRole('textbox')).toHaveValue(/^\w{5}-\w{5}/)
    await expectScreenshot(page, 'phone-totp-backup-codes.png', {
      mask: [dialog.getByRole('textbox')]
    })
  })
})
