import type { Page, Response } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { User } from '../models/User.js'

// Logs in through the admin's login dialog, which opens without a session.
async function login(page: Page, url: string, [username, password]: string[]) {
  await page.goto(`${url}/admin/`)
  const dialog = page.locator('.dito-dialog')
  await dialog.getByLabel('Username').fill(username)
  await dialog.getByLabel('Password').fill(password)
  await dialog.getByRole('button', { name: 'Sign In' }).click()
  await expect(dialog).toBeHidden()
}

function getAccountButton(page: Page) {
  return page.locator('.dito-account').getByRole('button')
}

function isSelfResponse(method: string) {
  return (response: Response) => (
    new URL(response.url()).pathname === '/api/users/self' &&
    response.request().method() === method
  )
}

test.describe('account settings', () => {
  test('focus the username of the login dialog', async ({ page, url }) => {
    await page.goto(`${url}/admin/`)
    // `autofocus` takes precedence over the dialog's submit button:
    const dialog = page.locator('.dito-dialog')
    await expect(dialog.getByLabel('Username')).toBeFocused()
  })

  test('edit the logged-in user', async ({ page, url }) => {
    await login(page, url, ['ada', 'secret'])
    await expect(getAccountButton(page)).toHaveText('ada')

    // Open the settings from the account menu:
    const selfLoaded = page.waitForResponse(isSelfResponse('GET'))
    await getAccountButton(page).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    const self = await (await selfLoaded).json()
    await expect(page).toHaveURL(`${url}/admin/account/settings`)

    // The form shows the user's data, without the password or its hash:
    expect(self).toMatchObject({ username: 'ada', email: 'ada@example.com' })
    expect(self).not.toHaveProperty('hash')
    expect(self).not.toHaveProperty('password')
    const username = page.getByLabel('Username', { exact: true })
    const email = page.getByLabel('Email', { exact: true })
    await expect(username).toHaveValue('ada')
    await expect(email).toHaveValue('ada@example.com')

    // Save the changes:
    await username.fill('lovelace')
    await email.fill('lovelace@example.com')
    const selfPatched = page.waitForResponse(isSelfResponse('PATCH'))
    await page.getByRole('button', { name: 'Save' }).click()
    expect((await selfPatched).status()).toBe(200)

    // The record changed, and the account menu shows it right away:
    const user = (await User.query().findOne('username', 'lovelace'))!
    expect(user.email).toBe('lovelace@example.com')
    await expect(getAccountButton(page)).toHaveText('lovelace')
  })

  test('cancel the settings for the root', async ({ page, url }) => {
    await login(page, url, ['ada', 'secret'])
    await getAccountButton(page).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    await expect(page).toHaveURL(`${url}/admin/account/settings`)
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(`${url}/admin/`)
    await expect(page.getByLabel('Username', { exact: true })).toBeHidden()
  })
})
