import { test, expect, Widget } from '../fixtures.js'
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
    // Seed a widget with two items in a known order. `insertGraph`
    // walks the relation and inserts the children in one round-trip.
    const widget = await Widget.query().insertGraph({
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

    // Reload via the list and confirm the order persisted through the
    // controller's `^withItems` scope, which uses the `ordered` modifier.
    await list.navigate('/widgets')
    await list.list.edit('Widget')
    await expect(items.rows.nth(0).getByLabel('Label')).toHaveValue('B')
    await expect(items.rows.nth(1).getByLabel('Label')).toHaveValue('A')

    // DB shape: SortableMixin reassigns `order` to match array index, so
    // labels in `order` ASC must be [B, A]. The `ordered` scope is auto-
    // applied because Widget.relations.items declares it.
    const persisted = await Widget.query()
      .findById(widget.$id() as number)
      .withGraphFetched('items')
    expect((persisted?.items ?? []).map(i => i.label)).toEqual(['B', 'A'])
  })
})
