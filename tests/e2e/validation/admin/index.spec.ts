import { test, expect } from '../fixtures.js'
import {
  DitoListView,
  DitoForm
} from '../../../utils/pages.js'

test.describe('validation', () => {
  test('invalid submit surfaces an error notification', async ({
    page,
    url
  }) => {
    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)

    await list.navigate('/widgets')
    await list.list.create()
    // Submit without filling Name (required + minLength 3). Server returns
    // 400; admin renders an error notification with generic text. Per-field
    // detail appears in field tooltips (not asserted here — would require a
    // dedicated page-object helper).
    await form.create()

    await expect(form.getNotification({ error: true })).toContainText(
      /validation|correct/i
    )
  })

  test('valid data creates a row', async ({ page, url }) => {
    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)

    await list.navigate('/widgets')
    await list.list.create()
    await form.fill('Name', 'Valid Name')
    await form.fill('Email', 'valid@example.com')
    await form.create()

    await expect(list.list.getRow('Valid Name')).toBeVisible()
  })
})
