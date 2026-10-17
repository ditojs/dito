import type { Page } from '@playwright/test'
import { test, expect, getLocalUrl } from '../fixtures.js'
import { Credential } from '../models/Credential.js'

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
    await page.goto(`${getLocalUrl(url)}/admin/`)

    // Log in with the password first:
    const login = page.getByRole('dialog')
    await login.getByLabel('Username').fill('ada')
    await login.getByLabel('Password').fill('secret')
    await login.getByRole('button', { name: 'Login', exact: true }).click()
    await expect(getAccountButton(page)).toHaveText('ada')

    // Add a passkey in the security dialog:
    const security = await openSecurity(page)
    await expect(security.locator('tbody tr')).toHaveCount(0)
    await security.getByRole('button', { name: 'Add Passkey' }).click()
    const add = page.getByRole('dialog', { name: 'Add Passkey' })
    await add.getByLabel('Name').fill('Laptop')
    await add.getByRole('button', { name: 'Add' }).click()
    await expect(security.locator('tbody tr')).toHaveCount(1)
    await expect(security.locator('tbody tr')).toContainText('Laptop')
    await expect(security.locator('tbody tr')).toContainText('Never')
    await security.getByRole('button', { name: 'Close' }).click()

    // Log out, and in again with the passkey:
    await getAccountButton(page).click()
    await page.getByRole('menuitem', { name: 'Logout' }).click()
    await page.locator('button.dito-login').click()
    await page.getByRole('button', { name: 'Login with Passkey' }).click()
    await expect(getAccountButton(page)).toHaveText('ada')
    const [credential] = await Credential.query()
    expect(credential.lastUsedAt).toBeInstanceOf(Date)

    // Delete the passkey:
    const dialog = await openSecurity(page)
    await expect(dialog.locator('tbody tr')).not.toContainText('Never')
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await page
      .getByRole('dialog', { name: 'Do you really want to delete Laptop?' })
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(dialog.locator('tbody tr')).toHaveCount(0)
    expect(await Credential.query()).toEqual([])
  })
})
