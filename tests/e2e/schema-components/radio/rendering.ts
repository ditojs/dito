import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { SelectWidget } from '../models/SelectWidget.js'

const { seed } = createModelHelpers(SelectWidget, 'select-widgets')

test(
  'radioVertical: 3 radio inputs in vertical list',
  async ({ page, url }) => {
    const widgetId = await seed({ radioVertical: 'beta' })
    await page.goto(`${url}/admin/select/${widgetId}`)
    await expect(
      page.locator('select').first()
    ).toBeVisible({ timeout: 15_000 })

    const list = page.locator('#radioVertical')
    await expect(
      list.locator('input[type="radio"]')
    ).toHaveCount(3)
    await expect(list).toHaveClass(/dito-layout--vertical/)
  }
)

test(
  'radioHorizontal: horizontal layout class',
  async ({ page, url }) => {
    const widgetId = await seed({ radioHorizontal: 'alpha' })
    await page.goto(`${url}/admin/select/${widgetId}`)
    await expect(
      page.locator('select').first()
    ).toBeVisible({ timeout: 15_000 })

    await expect(
      page.locator('#radioHorizontal')
    ).toHaveClass(/dito-layout--horizontal/)
  }
)
