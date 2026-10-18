import type { Page } from '@playwright/test'
import { test, expect, sentPasswordResets } from '../fixtures.js'

async function login(page: Page, password: string) {
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Username').fill('ada')
  await dialog.getByLabel('Password').fill(password)
  await dialog.getByRole('button', { name: 'Sign In', exact: true }).click()
}

async function setNewPassword(page: Page, url: string, password: string) {
  // Links that only change the fragment of the open page don't load it again,
  // so start from a blank page, like a new tab of the email's link:
  await page.goto('about:blank')
  await page.goto(url)
  const dialog = page.getByRole('dialog', { name: 'Set New Password' })
  await dialog.getByLabel('New Password', { exact: true }).fill(password)
  await dialog.getByLabel('Confirm New Password').fill(password)
  await dialog.getByRole('button', { name: 'Set Password' }).click()
  // Wait for the dialog to leave, as the login dialog asks next:
  await expect(dialog).toHaveCount(0)
}

test.describe('password reset', () => {
  test('resets the password through the emailed link', async ({
    page,
    url
  }) => {
    // Request the email from the login dialog:
    await page.goto(`${url}/admin/`)
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    const request = page.getByRole('dialog', { name: 'Reset Password' })
    await request.getByLabel('Username').fill('ada')
    await request.getByRole('button', { name: 'Send Email' }).click()
    await expect(page.locator('.dito-notification')).toContainText(
      'If the account exists, we sent you an email.'
    )
    await expect(page.getByRole('dialog').getByLabel('Password')).toBeVisible()
    expect(sentPasswordResets).toHaveLength(1)

    // Open the link on the admin's URL, and set a new password:
    const { hash } = new URL(sentPasswordResets[0])
    const link = `${url}/admin/${hash}`
    await setNewPassword(page, link, 'changed')
    await expect(page.locator('.dito-notification').last()).toContainText(
      'Your password was changed. Please log in.'
    )
    await expect(page).toHaveURL(`${url}/admin/`)

    // The old password fails, the new one logs in:
    await login(page, 'secret')
    await expect(page.locator('.dito-notification').last()).toContainText(
      'Password or username is incorrect'
    )
    await login(page, 'changed')
    await expect(page.locator('.dito-account')).toHaveText('ada')

    // The link only works once:
    await page.context().clearCookies()
    await setNewPassword(page, link, 'another')
    await expect(page.locator('.dito-notification').last()).toContainText(
      'Invalid or expired token'
    )
    await expect(page.getByRole('dialog').getByLabel('Username')).toBeVisible()
  })

  test('asks for a matching confirmation', async ({ page, url }) => {
    await page.goto(`${url}/admin/#password-reset=token`)
    const dialog = page.getByRole('dialog', { name: 'Set New Password' })
    await dialog.getByLabel('New Password', { exact: true }).fill('changed')
    await dialog.getByLabel('Confirm New Password').fill('different')
    await dialog.getByRole('button', { name: 'Set Password' }).click()
    await expect(dialog).toContainText('must match the new password')
  })
})
