import { test, expect, db } from '../fixtures.js'
import { Widget } from '../models/Widget.js'
import {
  DitoListView,
  DitoForm,
  DitoNestedList
} from '../../../utils/pages.js'

test.describe('drag reorder', () => {
  test('drag persists across reload and to the database', async ({
    page,
    url
  }) => {
    // Seed a widget with two items in a known order.
    const widget = await db.insert(Widget, {
      name: 'Widget',
      items: [
        { label: 'A', order: 0 },
        { label: 'B', order: 1 }
      ]
    })

    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)
    const items = new DitoNestedList(page, 'Items')

    await list.navigate('/widgets')
    await list.list.edit('Widget')

    // Sanity: items load in seeded order.
    await expect(items.rows).toHaveCount(2)
    await expect(items.rows.nth(0).getByLabel('Label')).toHaveValue('A')
    await expect(items.rows.nth(1).getByLabel('Label')).toHaveValue('B')

    // Adjacent swap. dragRow uses SortableJS's fallback drag, which
    // reliably swaps neighbours but skips swaps on multi-step drags.
    await items.dragRow(0, 1)
    await expect(items.rows.nth(0).getByLabel('Label')).toHaveValue('B')
    await expect(items.rows.nth(1).getByLabel('Label')).toHaveValue('A')

    await form.save()

    // Reload via the list and confirm the order persisted. The relation
    // loads the items by their `order`.
    await list.navigate('/widgets')
    await list.list.edit('Widget')
    await expect(items.rows.nth(0).getByLabel('Label')).toHaveValue('B')
    await expect(items.rows.nth(1).getByLabel('Label')).toHaveValue('A')

    // The admin sets `order` to the index of each item, so the labels in
    // `order` must be [B, A].
    const persisted = await db.findOne(Widget, widget.id, {
      populate: ['items']
    })
    expect(persisted?.items.map(i => i.label)).toEqual(['B', 'A'])
  })
})
