import { test, expect } from '../fixtures.js'
import { Widget } from '../models/Widget.js'
import {
  DitoListView,
  DitoForm,
  getMultiselect
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
    const tags = getMultiselect(page, 'Tags').locator('.dito-multiselect__tag')
    await expect(tags).toHaveText(['tag-1', 'tag-2'])

    // Re-fetch from DB and confirm the join-table relation persisted.
    const persisted = await Widget.query()
      .findById(widget.$id() as number)
      .withGraphFetched('tags')
    const persistedNames = (persisted?.tags ?? []).map(t => t.name).sort()
    expect(persistedNames).toEqual(['tag-1', 'tag-2'])

    // Clear all tags.
    await form.clearMultiselect('Tags')
    await form.save()

    // Reload, confirm empty.
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    await expect(tags).toHaveCount(0)

    const cleared = await Widget.query()
      .findById(widget.$id() as number)
      .withGraphFetched('tags')
    expect(cleared?.tags ?? []).toHaveLength(0)
  })

  test('shows values without options as unavailable chips', async ({
    page,
    url
  }) => {
    const widget = await Widget.query().insert({
      name: 'Widget A',
      size: 'Small',
      codes: ['a', 'gone']
    })
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    const codes = getMultiselect(page, 'Codes')
    await expect(codes.locator('.dito-multiselect__tag')).toHaveText([
      'Alpha',
      'gone'
    ])
    await expect(
      codes.locator('.dito-multiselect__tag--unavailable')
    ).toHaveText(['gone'])
    // Removing another value keeps the one without option.
    await codes
      .locator('.dito-multiselect__tag', { hasText: 'Alpha' })
      .getByRole('button', { name: /^Remove / })
      .click()
    await new DitoForm(page).save()
    const stored = await Widget.query().findById(widget.$id() as number)
    expect(stored?.codes).toEqual(['gone'])
  })

  test('keeps related values without options', async ({ page, url }) => {
    const widget = await Widget.query().insertGraph({
      name: 'Widget A',
      size: 'Small',
      tags: [{ name: 'tag-1' }, { name: 'hidden' }]
    })
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    const tags = getMultiselect(page, 'Tags')
    await expect(
      tags.locator('.dito-multiselect__tag--unavailable')
    ).toHaveText(['hidden'])
    await tags
      .locator('.dito-multiselect__tag', { hasText: 'tag-1' })
      .getByRole('button', { name: /^Remove / })
      .click()
    await new DitoForm(page).save()
    const stored = await Widget.query()
      .findById(widget.$id() as number)
      .withGraphFetched('tags')
    expect(stored?.tags?.map(tag => tag.name)).toEqual(['hidden'])
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
    await shape.fill('tri')
    await expect(page.getByRole('option', { name: 'Triangle' })).toBeVisible()
    // The internal search would match the "r" in "Circle" and "Square" too:
    await shape.fill('r')
    await expect(page.getByRole('option')).toHaveCount(0)
  })

  test('keeps values that searches filter out', async ({ page, url }) => {
    await Widget.query().insert({
      name: 'Widget A',
      size: 'Small',
      shape: 'triangle'
    })
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    const shape = page.getByRole('combobox', { name: 'Shape' })
    await expect(shape).toHaveValue('Triangle')
    await shape.click()
    await shape.fill('c')
    await expect(page.getByRole('option')).toHaveText(['Circle'])
    await page.keyboard.press('Escape')
    await expect(shape).toHaveValue('Triangle')
    await new DitoForm(page).save()
    const widget = await Widget.query().findOne({ name: 'Widget A' })
    expect(widget?.shape).toBe('triangle')
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
    await color.fill('gr')
    const options = page.getByRole('option')
    await expect(options).toHaveText(['Green'])
    await color.fill('b')
    await expect(options).toHaveText(['Blue'])
    await options.first().click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(
        async () => (await Widget.query().findOne({ name: 'Widget A' }))?.color
      )
      .toBe('Blue')
  })

  test('shows the options of the latest search', async ({ page, url }) => {
    await Widget.query().insert({ name: 'Widget A', size: 'Small' })
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    const paint = page.getByRole('combobox', { name: 'Paint' })
    await paint.click()
    await paint.fill('b')
    await paint.fill('bla')
    const options = page.getByRole('option')
    await expect(options).toHaveText(['Black'])
    // The search for "b" finishes later, and must not replace the options:
    await page.waitForTimeout(800)
    await expect(options).toHaveText(['Black'])
  })
})
