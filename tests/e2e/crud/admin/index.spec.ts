import { test, expect } from '../fixtures.js'
import {
  AdminListPage,
  DitoForm
} from '../../../utils/pages.js'

test.describe('crud', () => {
  // Warm the admin Vite bundle once per worker. The first navigation to a
  // new admin route triggers on-demand compilation that can exceed
  // per-test timeouts on CI cold starts.
  test.beforeAll(async ({ browser, url }) => {
    const page = await browser.newPage()
    try {
      await page.goto(`${url}/admin/widgets`, {
        waitUntil: 'networkidle'
      })
    } finally {
      await page.close()
    }
  })

  test('create, edit, delete round-trip', async ({ page, url }) => {
    const list = new AdminListPage(page, url, 'Widget')
    const form = new DitoForm(page)

    // Navigate. The Create button is a stable readiness signal — it's
    // always rendered when the list view is mounted, regardless of row
    // count. The empty table itself can register as "hidden" (zero
    // height), so we don't assert on it directly.
    await list.navigate('/widgets')
    await expect(
      page.getByRole('button', { name: 'Create', exact: true })
    ).toBeVisible()

    // Create — submit closes the form automatically (Dito's submit-button
    // schema defaults to closeForm: true), so we don't call clickButton
    // ('Close') after Create/Save.
    await list.list.create()
    await form.fill('Name', 'A')
    await form.create()
    await expect(list.list.getRow('A')).toBeVisible()

    // Edit.
    await list.list.edit('A')
    await form.fill('Name', 'B')
    await form.save()
    await expect(list.list.getRow('B')).toBeVisible()
    await expect(list.list.getRow('A')).not.toBeVisible()

    // Delete.
    await list.list.delete('B')
    await expect(list.list.getRow('B')).not.toBeVisible()
  })
})
