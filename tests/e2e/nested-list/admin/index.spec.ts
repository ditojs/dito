import { test, expect, Widget } from '../fixtures.js'
import {
  DitoListView,
  DitoForm,
  DitoNestedList
} from '../../../utils/pages.js'

test.describe('nested-list', () => {
  test('add items, save, reload, delete one, reload', async ({
    page,
    url
  }) => {
    // Seed a widget with no items initially.
    const widget = await Widget.query().insert({ name: 'Widget A' })

    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)
    const items = new DitoNestedList(page, 'Items')

    await list.navigate('/widgets')
    await list.list.edit('Widget A')

    // Add two items via the nested list. Each Add click appends a new
    // row whose inline form contains a Label field. Fill by row index
    // to disambiguate from the previously-added row.
    await items.add()
    await items.rows
      .nth(0)
      .getByLabel('Label', { exact: true })
      .fill('first')
    await items.add()
    await items.rows
      .nth(1)
      .getByLabel('Label', { exact: true })
      .fill('second')

    await form.save()

    // Reload via the list and confirm the items rehydrated with the
    // typed labels.
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    await expect(items.rows).toHaveCount(2)
    await expect(items.rows.nth(0).getByLabel('Label')).toHaveValue('first')
    await expect(items.rows.nth(1).getByLabel('Label')).toHaveValue('second')

    // Confirm DB state matches.
    const persisted = await Widget.query()
      .findById(widget.$id() as number)
      .withGraphFetched('items')
    const persistedLabels = (persisted?.items ?? [])
      .map(i => i.label)
      .sort()
    expect(persistedLabels).toEqual(['first', 'second'])

    // Delete the first item, save, reload, assert one remains with the
    // surviving label.
    await items.delete(0)
    await form.save()
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    await expect(items.rows).toHaveCount(1)
    await expect(items.rows.nth(0).getByLabel('Label')).toHaveValue('second')

    const remaining = await Widget.query()
      .findById(widget.$id() as number)
      .withGraphFetched('items')
    const remainingLabels = (remaining?.items ?? []).map(i => i.label)
    expect(remainingLabels).toEqual(['second'])
  })
})
