import { test, expect } from '../fixtures.js'
import { Widget } from '../models/Widget.js'
import { DitoListView, DitoForm } from '../../../utils/pages.js'

test.describe('stale saves', () => {
  test('refuses to save a widget that changed since', async ({
    page,
    url
  }) => {
    const widget = await Widget.query().insertAndFetch({ name: 'Widget A' })
    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    await expect(form.getField('Name')).toHaveValue('Widget A')

    // Another editor saves the widget after the form loaded it:
    await Widget.query().findById(widget.id).patch({ name: 'Widget C' })

    await form.getField('Name').fill('Widget B')
    const request = page.waitForRequest(request => request.method() === 'PATCH')
    await form.save()
    expect((await request).headers()['dito-record-version']).toBe('0')
    await expect(
      form.getNotification({ error: true, hasText: 'changed since' })
    ).toBeVisible()
    expect((await Widget.query().findById(widget.id))!.name).toBe('Widget C')
  })
})
