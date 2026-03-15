import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { DateWidget } from '../models/DateWidget.js'

const { seed, saveAndFetch } = createModelHelpers(DateWidget, 'date-widgets')

test(
  'colorBasic: type hex value and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      colorBasic: '#ff0000'
    })

    await page.goto(
      `${url}/admin/date/${widgetId}`
    )
    await expect(
      page.locator('input#colorBasic')
    ).toBeVisible({ timeout: 15_000 })

    const input = page.locator('input#colorBasic')
    await input.fill('00ff00')
    await input.blur()
    await expect(input).toHaveValue('00ff00')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.colorBasic).toBe('#00ff00')
  }
)

test(
  'colorNoValue: type hex creates preview and persist',
  async ({ page, url }) => {
    // colorNoValue is null initially — not seeded
    const widgetId = await seed({})

    await page.goto(
      `${url}/admin/date/${widgetId}`
    )
    await expect(
      page.locator('input#colorNoValue')
    ).toBeVisible({ timeout: 15_000 })

    const color = page.locator(
      '.dito-color'
    ).filter({
      has: page.locator('input#colorNoValue')
    })
    const input = page.locator('input#colorNoValue')
    await input.fill('0000ff')
    await input.blur()
    await expect(
      color.locator('.dito-color__preview')
    ).toBeVisible()

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.colorNoValue).toBe('#0000ff')
  }
)
