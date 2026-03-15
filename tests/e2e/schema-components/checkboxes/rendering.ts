import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { SelectWidget } from '../models/SelectWidget.js'

const { seed } = createModelHelpers(SelectWidget, 'select-widgets')

test(
  'checkboxesVertical: 3 checkboxes in vertical list',
  async ({ page, url }) => {
    const widgetId = await seed({
      checkboxesVertical: ['alpha', 'beta']
    })
    await page.goto(`${url}/admin/select/${widgetId}`)
    await expect(
      page.locator('select').first()
    ).toBeVisible({ timeout: 15_000 })

    const list = page.locator('#checkboxesVertical')
    await expect(
      list.locator('input[type="checkbox"]')
    ).toHaveCount(3)
    await expect(list).toHaveClass(/dito-layout--vertical/)
  }
)

test(
  'checkboxesHorizontal: horizontal layout class',
  async ({ page, url }) => {
    const widgetId = await seed({
      checkboxesHorizontal: ['gamma']
    })
    await page.goto(`${url}/admin/select/${widgetId}`)
    await expect(
      page.locator('select').first()
    ).toBeVisible({ timeout: 15_000 })

    await expect(
      page.locator('#checkboxesHorizontal')
    ).toHaveClass(/dito-layout--horizontal/)
  }
)
