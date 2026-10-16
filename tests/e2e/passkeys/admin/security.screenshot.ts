import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { expectScreenshot } from '../../screenshots/scenes.js'
import { Credential } from '../models/Credential.js'
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
// that the credentials exist:
async function addTotp() {
  const user = await User.query().findOne({ username: 'ada' })
  for (const type of ['totp', ...Array(10).fill('backup-code')]) {
    await Credential.query().insert({
      type,
      userModel: 'User',
      userId: `${user!.id}`,
      data: {}
    } as any)
  }
}

// The server creates a random secret for each setup, and only confirms codes
// of it, so we answer both with fixed data for screenshots that stay the same:
async function mockTotpSetup(page: Page) {
  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
  await page.route('**/api/users/totp', route =>
    route.request().method() === 'POST'
      ? route.fulfill({
          json: {
            uri: `otpauth://totp/Example:ada?issuer=Example&secret=${secret}`,
            secret
          }
        })
      : route.continue()
  )
  await page.route('**/api/users/totp-confirm', route =>
    route.fulfill({
      json: {
        backupCodes: Array.from(
          { length: 10 },
          (_, index) => `${index}a2b4-c6d8e`
        )
      }
    })
  )
}

async function openTotpSetup(page: Page, url: string) {
  await mockTotpSetup(page)
  await login(page, url)
  const security = await openSecurity(page)
  await security.getByRole('button', { name: 'Set Up' }).click()
  const dialog = page.getByRole('dialog', {
    name: 'Set Up Two-Factor Authentication'
  })
  await expect(dialog.getByRole('img', { name: 'QR code' })).toBeVisible()
  return dialog
}

test.describe('screenshots', () => {
  test('login dialog with passkeys', async ({ page, url }) => {
    await page.goto(`${url}/admin/`)
    await expect(
      page.getByRole('button', { name: 'Sign In with Passkey' })
    ).toBeVisible()
    await expectScreenshot(page, 'login-passkeys.png')
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
    await expect(dialog.getByLabel('Current Password')).toBeFocused()
    await expectScreenshot(page, 'change-password.png')
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
    const dialog = await openTotpSetup(page, url)
    await expect(dialog.getByLabel('Authentication Code')).toBeFocused()
    await expectScreenshot(page, 'totp-setup.png')
  })

  test('backup codes dialog', async ({ page, url }) => {
    const setup = await openTotpSetup(page, url)
    await setup.getByLabel('Authentication Code').fill('123456')
    await setup.getByRole('button', { name: 'Turn On' }).click()
    const dialog = page.getByRole('dialog', { name: 'Backup Codes' })
    await expect(dialog.getByRole('textbox')).toHaveValue(/0a2b4-c6d8e/)
    await expectScreenshot(page, 'totp-backup-codes.png')
  })

  test('turn off TOTP dialog', async ({ page, url }) => {
    await login(page, url)
    await addTotp()
    const security = await openSecurity(page)
    await security.getByRole('button', { name: 'Turn Off' }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Turn Off Two-Factor Authentication'
    })
    await expect(dialog.getByLabel('Authentication Code')).toBeFocused()
    await expectScreenshot(page, 'totp-turn-off.png')
  })
})
