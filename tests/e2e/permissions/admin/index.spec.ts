import { test, expect } from '../fixtures.js'
import { Vault } from '../models/Vault.js'
import { DitoForm } from '../../../utils/pages.js'

test.describe('permissions', () => {
  test('shows missing permissions on lists in forms', async ({ page, url }) => {
    // Several lists of a form may be affected, so the error is shown on each.
    await page.goto(`${url}/admin/vaults/1`)
    await expect(page.locator('.dito-errors')).toContainText(
      `You don't have permission to load this data.`
    )
    await expect(page.locator('.dito-notification')).toHaveCount(0)
  })

  test('saves forms with lists without permission', async ({ page, url }) => {
    await page.goto(`${url}/admin/vaults/1`)
    await expect(page.locator('.dito-errors')).toContainText('permission')
    await page.getByLabel('Name', { exact: true }).fill('Renamed')
    await new DitoForm(page).save()
    expect((await Vault.query().findById(1))?.name).toBe('Renamed')
  })

  test('notifies about missing permissions of views', async ({ page, url }) => {
    await page.goto(`${url}/admin/secrets`)
    await expect(page.locator('.dito-notification')).toContainText(
      'Unauthorized Access'
    )
  })

  test('notifies about missing permissions of forms', async ({
    page,
    url
  }) => {
    await page.goto(`${url}/admin/secrets/1`)
    await expect(page.locator('.dito-notification')).toContainText(
      'Unauthorized Access'
    )
  })
})
