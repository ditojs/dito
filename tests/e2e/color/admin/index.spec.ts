import type { Page } from '@playwright/test'
import { test, expect, createModelHelpers, Widget } from '../fixtures.js'
import { DitoListView } from '../../../utils/pages.js'

const { seed, saveAndFetch } = createModelHelpers(Widget, 'widgets', {
  name: 'Widget A'
})

async function editWidget(page: Page, url: string) {
  const list = new DitoListView(page, url, 'Widget')
  await list.navigate('/widgets')
  await list.list.edit('Widget A')
}

// The picker opens on focus of the color input.
async function openPicker(page: Page, label: string) {
  await page.getByLabel(label, { exact: true }).click()
  const picker = page.getByLabel('Sketch color picker')
  await expect(picker).toBeVisible()
  return picker
}

// Picks a preset swatch, then clicks an empty area to close the picker, so
// it doesn't cover the form buttons.
async function pickPreset(page: Page, label: string, preset: string) {
  const picker = await openPicker(page, label)
  await picker.getByLabel(preset, { exact: true }).click()
  await page.mouse.click(1000, 400)
  await expect(picker).toBeHidden()
}

test.describe('color', () => {
  test('typed hex value is stored as lowercase hex', async ({ page, url }) => {
    const id = await seed()
    await editWidget(page, url)
    await page.getByLabel('Color', { exact: true }).fill('FF7F27')
    const widget = await saveAndFetch(page, id)
    expect(widget.color).toBe('#ff7f27')
  })

  test('stored value is shown without hash', async ({ page, url }) => {
    await seed({ color: '#00a2e8' })
    await editWidget(page, url)
    await expect(page.getByLabel('Color', { exact: true })).toHaveValue(
      '00a2e8'
    )
  })

  test('picking a preset stores its hex value', async ({ page, url }) => {
    const id = await seed()
    await editWidget(page, url)
    await pickPreset(page, 'Color', 'Color:#ed1c24')
    await expect(page.getByLabel('Color', { exact: true })).toHaveValue(
      'ed1c24'
    )
    const widget = await saveAndFetch(page, id)
    expect(widget.color).toBe('#ed1c24')
  })

  test('picker changes update the input after typing', async ({
    page,
    url
  }) => {
    const id = await seed()
    await editWidget(page, url)
    const input = page.getByLabel('Color', { exact: true })
    const picker = await openPicker(page, 'Color')
    await input.fill('ff0000')
    await expect(picker.getByLabel('Hex', { exact: true })).toHaveValue(
      'ff0000'
    )
    await picker.getByLabel('Color:#00a2e8', { exact: true }).click()
    await expect(input).toHaveValue('00a2e8')
    const widget = await saveAndFetch(page, id)
    expect(widget.color).toBe('#00a2e8')
  })

  test('picker shows the hex value in lowercase', async ({ page, url }) => {
    await seed({ color: '#00a2e8' })
    await editWidget(page, url)
    const picker = await openPicker(page, 'Color')
    await expect(picker.getByLabel('Hex', { exact: true })).toHaveValue(
      '00a2e8'
    )
  })

  test('clear button shows when hovering the input, not the picker', async ({
    page,
    url
  }) => {
    await seed({ color: '#00a2e8' })
    await editWidget(page, url)
    const picker = await openPicker(page, 'Color')
    const clear = page.getByRole('button', { name: 'Clear' })
    await page.getByLabel('Color', { exact: true }).hover()
    await expect(clear).toBeVisible()
    await picker.hover()
    await expect(clear).toBeHidden()
  })

  test('rgb format stores an rgb object', async ({ page, url }) => {
    const id = await seed()
    await editWidget(page, url)
    await pickPreset(page, 'RGB Color', 'Color:#ed1c24')
    const widget = await saveAndFetch(page, id)
    expect(widget.rgbColor).toEqual({ r: 237, g: 28, b: 36, a: 1 })
  })

  test('rgb object is shown as hex', async ({ page, url }) => {
    await seed({ rgbColor: { r: 0, g: 162, b: 232, a: 1 } })
    await editWidget(page, url)
    await expect(page.getByLabel('RGB Color', { exact: true })).toHaveValue(
      '00a2e8'
    )
  })

  test('hsl format stores an hsl object', async ({ page, url }) => {
    const id = await seed()
    await editWidget(page, url)
    await pickPreset(page, 'HSL Color', 'Color:#ffffff')
    const widget = await saveAndFetch(page, id)
    expect(widget.hslColor).toEqual({ h: 0, s: 0, l: 1, a: 1 })
  })

  test('hsl object is shown as hex', async ({ page, url }) => {
    await seed({ hslColor: { h: 0, s: 0, l: 1, a: 1 } })
    await editWidget(page, url)
    await expect(page.getByLabel('HSL Color', { exact: true })).toHaveValue(
      'ffffff'
    )
  })

  test('name format stores a color name', async ({ page, url }) => {
    const id = await seed()
    await editWidget(page, url)
    await pickPreset(page, 'Name Color', 'Color:#000000')
    const widget = await saveAndFetch(page, id)
    expect(widget.nameColor).toBe('black')
  })

  test('transparent preset with alpha stores hex8', async ({ page, url }) => {
    const id = await seed()
    await editWidget(page, url)
    await pickPreset(page, 'Alpha Color', 'Color: transparency')
    const widget = await saveAndFetch(page, id)
    expect(widget.alphaColor).toBe('#00000000')
  })
})
