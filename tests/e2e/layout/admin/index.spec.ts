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

  test('toggles sections on a click after their label', async ({
    page,
    url
  }) => {
    await Widget.query().insert({ name: 'Widget A', settings: {} })
    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    await form.selectTab('Details')
    const label = page.getByRole('button', { name: 'Settings', exact: true })
    const box = (await label.boundingBox())!
    const text = (await label.getByText('Settings').boundingBox())!
    // Click the empty space at the end of the label, well after its text:
    const x = box.width - 2
    expect(box.x + x).toBeGreaterThan(text.x + text.width + 100)
    await label.click({ position: { x, y: box.height / 2 } })
    await expect(form.getField('Color')).toBeHidden()
    await label.click({ position: { x, y: box.height / 2 } })
    await expect(form.getField('Color')).toBeVisible()
  })

  test('clips long suffixes of collapsible item labels', async ({
    page,
    url
  }) => {
    await Widget.query().insert({
      name: 'Widget A',
      links: [{ url: `https://example.com/${'long/'.repeat(100)}` }]
    })
    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)
    await list.navigate('/widgets')
    await list.list.edit('Widget A')
    await form.selectTab('Details')
    const links = page.getByRole('region', { name: 'Links' })
    const suffix = links.locator('.dito-affix--ellipsis')
    await expect(suffix).toBeVisible()
    const listBox = (await links.boundingBox())!
    const suffixBox = (await suffix.boundingBox())!
    expect(suffixBox.width).toBeGreaterThan(0)
    expect(suffixBox.x + suffixBox.width).toBeLessThanOrEqual(
      listBox.x + listBox.width
    )
    // The text is longer than the suffix, which clips it with an ellipsis:
    expect(
      await suffix.evaluate(element => ({
        isClipped: element.scrollWidth > element.clientWidth,
        textOverflow: getComputedStyle(element).textOverflow
      }))
    ).toEqual({ isClipped: true, textOverflow: 'ellipsis' })
  })
})
