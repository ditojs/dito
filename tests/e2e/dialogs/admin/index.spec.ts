import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'

async function openDialog(page: Page, url: string) {
  await page.goto(`${url}/admin/dialogs`)
  const button = page.getByRole('button', { name: 'Open Dialog' })
  await button.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return { button, dialog }
}

test.describe('dialog', () => {
  test('closes with `clickToClose` and returns the focus to its button', async ({
    page,
    url
  }) => {
    const { button, dialog } = await openDialog(page, url)
    // Clicks in the dialog keep it open:
    await dialog.getByLabel('Message', { exact: true }).click()
    await expect(dialog).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(dialog).toBeHidden()
    await expect(button).toBeFocused()
  })

  test('closes with Escape and returns the focus to its button', async ({
    page,
    url
  }) => {
    const { button, dialog } = await openDialog(page, url)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(button).toBeFocused()
  })
})
