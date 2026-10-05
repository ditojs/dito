import { test, expect } from '../fixtures.js'
import { Widget } from '../models/Widget.js'
import {
  DitoListView,
  DitoForm
} from '../../../utils/pages.js'

test.describe('multiselect', () => {
  test('select tags, save, reload — value persists; clear, save, reload — empty', async ({
    page,
    url
  }) => {
    // Seed a widget tied to no tags initially.
    const widget = await Widget.query().insert({
      name: 'Widget A',
      size: 'Small'
    })

    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)

    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    await form.fillMultiselect('Tags', 'tag-1')
    await form.fillMultiselect('Tags', 'tag-2')
    await form.save()

    // Reload from main list.
    await list.navigate('/widgets')
    await list.list.edit('Widget A')

    // Tag chips should be visible. Each chip carries the tag's name; the
    // multiselect renders selected items as chips inside the combobox.
    const tagsCombobox = page.getByRole('combobox', { name: 'Tags' })
    await expect(tagsCombobox).toContainText('tag-1')
    await expect(tagsCombobox).toContainText('tag-2')

    // Re-fetch from DB and confirm the join-table relation persisted.
    const persisted = await Widget.query().findById(widget.$id() as number).withGraphFetched('tags')
    const persistedNames = (persisted?.tags ?? []).map(t => t.name).sort()
    expect(persistedNames).toEqual(['tag-1', 'tag-2'])

    // Clear all tags.
    await form.clearMultiselect('Tags')
    await form.save()

    // Reload, confirm empty.
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    await expect(tagsCombobox).not.toContainText('tag-1')
    await expect(tagsCombobox).not.toContainText('tag-2')

    const cleared = await Widget.query().findById(widget.$id() as number).withGraphFetched('tags')
    expect(cleared?.tags ?? []).toHaveLength(0)
  })

  test('keeps the errors of deselected required values', async ({
    page,
    url
  }) => {
    // Deselecting closes the multiselect, which validates the new value in
    // the same tick as the value changes.
    await Widget.query().insert({ name: 'Widget A', size: 'Small' })
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    const size = page.getByRole('combobox', { name: 'Size' })
    await size.click()
    await page.getByRole('option', { name: 'Small' }).click()
    const errors = page
      .locator('.dito-container')
      .filter({ has: size })
      .last()
      .locator('.dito-errors')
    await expect(errors).toContainText(/required/)
  })
})
