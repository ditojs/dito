import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { LayoutWidget } from '../models/LayoutWidget.js'

const { seed } = createModelHelpers(
  LayoutWidget, 'layout-widgets'
)

test(
  'buttonBasic: click fires onClick',
  async ({ page, url }) => {
    const widgetId = await seed({
      sectionDetail: 'detail value'
    })

    await page.goto(
      `${url}/admin/layout/${widgetId}`
    )
    await expect(
      page.locator('button.dito-button').first()
    ).toBeVisible({ timeout: 15_000 })

    const button = page.locator(
      'button.dito-button'
    ).filter({ hasText: 'Click Me' })
    await button.click()
    // onClick sets data-clicked on the button
    await expect(button).toHaveAttribute(
      'data-clicked', 'true'
    )
  }
)

test(
  'buttonDisabled: is disabled',
  async ({ page, url }) => {
    const widgetId = await seed({
      sectionDetail: 'detail value'
    })

    await page.goto(
      `${url}/admin/layout/${widgetId}`
    )
    await expect(
      page.locator('button.dito-button').first()
    ).toBeVisible({ timeout: 15_000 })

    const button = page.locator(
      'button.dito-button'
    ).filter({ hasText: 'Disabled' })
    await expect(button).toBeDisabled()
  }
)
