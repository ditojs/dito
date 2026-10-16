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
  await dialog.getByRole('button', { name: 'Login', exact: true }).click()
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

test.describe('screenshots', () => {
  test('login dialog with passkeys', async ({ page, url }) => {
    await page.goto(`${url}/admin/`)
    await expect(
      page.getByRole('button', { name: 'Login with Passkey' })
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
    await security.getByRole('button', { name: 'Change Password' }).click()
    const dialog = page.getByRole('dialog', { name: 'Change Password' })
    await expect(dialog.getByLabel('Current Password')).toBeFocused()
    await expectScreenshot(page, 'change-password.png')
  })
})
