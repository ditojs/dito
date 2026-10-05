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

  test('filters options through `search` with the search term', async ({
    page,
    url
  }) => {
    await Widget.query().insert({ name: 'Widget A', size: 'Small' })
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    const shape = page.getByRole('combobox', { name: 'Shape' })
    await shape.click()
    await shape.locator('input').fill('tri')
    await expect(page.getByRole('option', { name: 'Triangle' })).toBeVisible()
    // The internal search would match the "r" in "Circle" and "Square" too:
    await shape.locator('input').fill('r')
    await expect(page.getByRole('option')).toHaveCount(0)
  })

  test('filters asynchronously loaded options through async `search`', async ({
    page,
    url
  }) => {
    await Widget.query().insert({ name: 'Widget A', size: 'Small' })
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    const color = page.getByRole('combobox', { name: 'Color' })
    await color.click()
    await color.locator('input').fill('gr')
    const options = page.getByRole('option')
    await expect(options).toHaveText(['Green'])
    await color.locator('input').fill('b')
    await expect(options).toHaveText(['Blue'])
    await options.first().click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => (await Widget.query().findOne({ name: 'Widget A' }))?.color)
      .toBe('Blue')
  })

  test('shows the options of the latest search', async ({ page, url }) => {
    await Widget.query().insert({ name: 'Widget A', size: 'Small' })
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    const paint = page.getByRole('combobox', { name: 'Paint' })
    await paint.click()
    await paint.locator('input').fill('b')
    await paint.locator('input').fill('bla')
    const options = paint.getByRole('option')
    await expect(options).toHaveText(['Black'])
    // The search for "b" finishes later, and must not replace the options:
    await page.waitForTimeout(800)
    await expect(options).toHaveText(['Black'])
  })
})
