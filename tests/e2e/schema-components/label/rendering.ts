import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { LayoutWidget } from '../models/LayoutWidget.js'

const { seed } = createModelHelpers(
  LayoutWidget, 'layout-widgets'
)

test(
  'layout view: label',
  async ({ page, url }) => {
    const widgetId = await seed({
      sectionDetail: 'detail value'
    })

    await page.goto(
      `${url}/admin/layout/${widgetId}`
    )
    await expect(
      page.locator('.dito-section').first()
    ).toBeVisible({ timeout: 15_000 })

    await test.step(
      'labelDefault: displays default text',
      async () => {
        await expect(
          page.locator('.dito-label-component')
        ).toContainText('Read-only info')
      }
    )
  }
)
