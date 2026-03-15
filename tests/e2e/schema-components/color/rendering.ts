import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { DateWidget } from '../models/DateWidget.js'

const { seed } = createModelHelpers(DateWidget, 'date-widgets')

test('colorBasic: preview swatch visible', async ({ page, url }) => {
  const widgetId = await seed({ colorBasic: '#ff0000' })
  await page.goto(`${url}/admin/date/${widgetId}`)
  await expect(
    page.locator('input#colorBasic')
  ).toBeVisible({ timeout: 15_000 })

  await expect(
    page.locator('.dito-color')
      .filter({ has: page.locator('input#colorBasic') })
      .locator('.dito-color__preview')
  ).toBeVisible()
})

test(
  'colorNoValue: preview swatch not visible',
  async ({ page, url }) => {
    const widgetId = await seed({})
    await page.goto(`${url}/admin/date/${widgetId}`)
    await expect(
      page.locator('input#colorNoValue')
    ).toBeVisible({ timeout: 15_000 })

    await expect(
      page.locator('.dito-color')
        .filter({ has: page.locator('input#colorNoValue') })
        .locator('.dito-color__preview')
    ).not.toBeVisible()
  }
)
