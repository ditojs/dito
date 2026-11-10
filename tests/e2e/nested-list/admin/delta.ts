import { test, expect } from '../fixtures.js'
import { Widget } from '../models/Widget.js'
import {
  DitoListView,
  DitoForm,
  DitoNestedList
} from '../../../utils/pages.js'

test.describe('deltas', () => {
  test('saves only the delta against the loaded widget', async ({
    page,
    url
  }) => {
    const widget = await Widget.query().insertGraphAndFetch({
      name: 'Widget A',
      items: [
        { label: 'a', order: 0 },
        { label: 'b', order: 1 },
        { label: 'c', order: 2 }
      ]
    })
    const [, b, c] = widget.items!

    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)
    const items = new DitoNestedList(page, 'Items')

    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    await expect(items.rows).toHaveCount(3)

    await items.rows.nth(1).getByLabel('Label', { exact: true }).fill('b2')
    await items.delete(2)
    await items.add()
    await items.rows.nth(2).getByLabel('Label', { exact: true }).fill('d')

    const request = page.waitForRequest(request => request.method() === 'PATCH')
    await form.save()
    const patch = await request
    expect(patch.postDataJSON()).toEqual({
      '#delta': true,
      'items': [
        { id: b.id, label: 'b2' },
        { label: 'd', order: 2 },
        { 'id': c.id, '#removed': true }
      ]
    })

    const saved = await Widget.query()
      .findById(widget.id)
      .withGraphFetched('items')
    expect(saved!.items!.map(item => item.label)).toEqual(['a', 'b2', 'd'])
  })
})
