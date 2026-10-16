import type { Page } from '@playwright/test'
import { TOTP } from 'otpauth'
import { test, expect } from '../fixtures.js'
import { Credential } from '../models/Credential.js'

function getAccountButton(page: Page) {
  return page.locator('.dito-account').getByRole('button')
}

async function loginWithPassword(page: Page) {
  const login = page.getByRole('dialog')
  await login.getByLabel('Username').fill('ada')
  await login.getByLabel('Password').fill('secret')
  await login.getByRole('button', { name: 'Login', exact: true }).click()
}

async function openSecurity(page: Page) {
  await getAccountButton(page).click()
  await page.getByRole('menuitem', { name: 'Security' }).click()
  return page.getByRole('dialog', { name: 'Security' })
}

test.describe('TOTP', () => {
  test('set up, log in with a code and turn off', async ({ page, url }) => {
    await page.goto(`${url}/admin/`)
    await loginWithPassword(page)
    await expect(getAccountButton(page)).toHaveText('ada')

    // Set up TOTP in the security dialog, with the key for manual entry:
    const security = await openSecurity(page)
    await expect(security).toContainText('Not set up')
    await security.getByRole('button', { name: 'Set Up' }).click()
    const setup = page.getByRole('dialog', {
      name: 'Set Up Two-Factor Authentication'
    })
    await expect(setup.getByRole('img', { name: 'QR code' })).toBeVisible()
    // `autofocus` focuses the code, not the key before it:
    await expect(setup.getByLabel('Authentication Code')).toBeFocused()
    const secret = await setup.getByLabel('Or enter the key').inputValue()
    const totp = new TOTP({ secret: secret.replaceAll(' ', '') })
    await setup.getByLabel('Authentication Code').fill(totp.generate())
    await setup.getByRole('button', { name: 'Turn On' }).click()
    const codes = page.getByRole('dialog', { name: 'Backup Codes' })
    const backupCodes = (await codes.getByRole('textbox').inputValue()).split(
      /\s+/
    )
    expect(backupCodes).toHaveLength(10)
    await codes.getByRole('button', { name: 'Done' }).click()
    await expect(security).toContainText('Enabled · 10 backup codes left')
    await security.getByRole('button', { name: 'Close' }).click()

    // Log out, and in again with the password and the next code, as the
    // current one confirmed the setup:
    await getAccountButton(page).click()
    await page.getByRole('menuitem', { name: 'Logout' }).click()
    await page.locator('button.dito-login').click()
    await loginWithPassword(page)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Authentication Code').fill('wrong')
    await dialog.getByRole('button', { name: 'Verify' }).click()
    await expect(page.locator('.dito-notification')).toContainText(
      'Code is incorrect'
    )
    // Wait for the dialog of the wrong code to leave, as the next one asks:
    await expect(dialog).toHaveCount(1)
    await dialog
      .getByLabel('Authentication Code')
      .fill(totp.generate({ timestamp: Date.now() + totp.period * 1000 }))
    await dialog.getByRole('button', { name: 'Verify' }).click()
    await expect(getAccountButton(page)).toHaveText('ada')
    const [credential] = await Credential.query().where('type', 'totp')
    expect(credential.lastUsedAt).toBeInstanceOf(Date)

    // Turn off TOTP with a backup code:
    const turnOff = await openSecurity(page)
    await turnOff.getByRole('button', { name: 'Turn Off' }).click()
    const confirm = page.getByRole('dialog', {
      name: 'Turn Off Two-Factor Authentication'
    })
    await confirm.getByLabel('Authentication Code').fill(backupCodes[0])
    await confirm.getByRole('button', { name: 'Turn Off' }).click()
    await expect(turnOff).toContainText('Not set up')
    expect(await Credential.query()).toEqual([])
  })
})
