import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { LayoutWidget } from '../models/LayoutWidget.js'

const { seed } = createModelHelpers(
  LayoutWidget, 'layout-widgets'
)

test(
  'sectionLabelled: has labelled class',
  async ({ page, url }) => {
    const widgetId = await seed({
      sectionDetail: 'detail value'
    })

    await page.goto(
      `${url}/admin/layout/${widgetId}`
    )
    await expect(
      page.locator('.dito-section--labelled').first()
    ).toBeVisible({ timeout: 15_000 })
  }
)

test(
  'sectionCollapsible: has chevron in label',
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

    await expect(
      page.locator(
        'button.dito-label:has(.dito-chevron)'
      )
    ).toBeVisible()
  }
)
