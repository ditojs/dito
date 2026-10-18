import type { Page } from '@playwright/test'
import { test, expect, getLocalUrl } from '../fixtures.js'
import { Credential } from '../models/Credential.js'
import { User } from '../models/User.js'

// Gives the browser a passkey authenticator that verifies the user, like a
// fingerprint reader, through the Chrome DevTools Protocol:
async function addVirtualAuthenticator(page: Page) {
  const client = await page.context().newCDPSession(page)
  await client.send('WebAuthn.enable')
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true
    }
  })
}

async function login(page: Page, url: string, password: string) {
  await page.goto(`${getLocalUrl(url)}/admin/`)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Username').fill('ada')
  await dialog.getByLabel('Password').fill(password)
  await dialog.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(getAccountButton(page)).toHaveText('ada')
}

function getAccountButton(page: Page) {
  return page.locator('.dito-account').getByRole('button')
}

async function openSecurity(page: Page) {
  await getAccountButton(page).click()
  await page.getByRole('menuitem', { name: 'Security' }).click()
  return page.getByRole('dialog', { name: 'Security' })
}

test.describe('passkeys', () => {
  test('add, log in with and delete a passkey', async ({ page, url }) => {
    await addVirtualAuthenticator(page)
    // Log in with the password first:
    await login(page, url, 'secret')

    // Add a passkey in the security dialog, named by the server after its
    // provider, which the virtual authenticator doesn't have:
    const security = await openSecurity(page)
    await expect(security.locator('tbody tr')).toHaveText('No passkeys yet.')
    await security.getByRole('button', { name: 'Add Passkey' }).click()
    await expect(security.locator('tbody tr')).toContainText('Passkey')
    await expect(security.locator('tbody tr')).toContainText('Never')
    await security.getByRole('button', { name: 'Close' }).click()

    // Log out, and in again with the passkey:
    await getAccountButton(page).click()
    await page.getByRole('menuitem', { name: 'Sign Out' }).click()
    await page.locator('button.dito-login').click()
    await page.getByRole('button', { name: 'Sign In with Passkey' }).click()
    await expect(getAccountButton(page)).toHaveText('ada')
    const [credential] = await Credential.query()
    expect(credential.lastUsedAt).toBeInstanceOf(Date)

    // Delete the passkey:
    const dialog = await openSecurity(page)
    await expect(dialog.locator('tbody tr')).not.toContainText('Never')
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await page
      .getByRole('dialog', {
        name: 'Do you really want to delete the passkey?'
      })
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(dialog.locator('tbody tr')).toHaveText('No passkeys yet.')
    expect(await Credential.query()).toEqual([])
  })

  test('change the password', async ({ page, browser, url }) => {
    await login(page, url, 'secret')
    const security = await openSecurity(page)
    await security.getByRole('button', { name: 'Change', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Change Password' })
    await dialog.getByLabel('New Password', { exact: true }).fill('changed')
    await dialog.getByLabel('Confirm New Password').fill('changed')
    await dialog.getByRole('button', { name: 'Change Password' }).click()
    await expect(dialog).toBeHidden()
    const user = await User.query().findOne({ username: 'ada' })
    expect(await user!.$verifyPassword('changed')).toBe(true)

    // The new password works for a fresh login:
    const context = await browser.newContext()
    try {
      const freshPage = await context.newPage()
      await login(freshPage, url, 'changed')
    } finally {
      await context.close()
    }
  })
})
