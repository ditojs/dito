import { test, expect } from '../fixtures.js'
import { Widget } from '../models/Widget.js'
import { DitoForm, DitoListView } from '../../../utils/pages.js'

test.describe('layout', () => {
  test('opens the default tab', async ({ page, url }) => {
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.create()
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Notes', { exact: true })).toBeHidden()
  })

  test('creates records with fields from all tabs and panels', async ({
    page,
    url
  }) => {
    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)
    await list.navigate('/widgets')
    await list.list.create()
    await form.fill('Name', 'Widget A')
    await form.select('Size', 'Large')
    await form.selectTab('Details')
    await form.fill('Notes', 'Some notes')
    // Nested sections default to an empty object, so they can be filled in
    // when creating records.
    await form.fill('Color', 'red')
    await form.create()
    const widget = await Widget.query().findOne({ name: 'Widget A' })
    expect(widget).toMatchObject({
      notes: 'Some notes',
      settings: { color: 'red' },
      size: 'Large'
    })
  })

  test('shows stored values in tabs and panels', async ({ page, url }) => {
    await Widget.query().insert({
      name: 'Widget A',
      notes: 'Stored notes',
      settings: { color: 'blue' },
      size: 'Small'
    })
    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    await expect(form.getField('Name')).toHaveValue('Widget A')
    await expect(form.getField('Size')).toHaveValue('Small')
    await form.selectTab('Details')
    await expect(form.getField('Notes')).toHaveValue('Stored notes')
    await expect(form.getField('Color')).toHaveValue('blue')
  })
})
