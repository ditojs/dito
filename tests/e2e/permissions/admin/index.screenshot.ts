import { test, expect } from '../fixtures.js'

// See `e2e/screenshots` for how screenshot tests run.

test('list without permission in a form', async ({ page, url }) => {
  await page.goto(`${url}/admin/vaults/1`)
  await expect(page.locator('.dito-errors')).toContainText('permission')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('list-without-permission.png')
})
