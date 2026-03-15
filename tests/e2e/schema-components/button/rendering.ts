import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { LayoutWidget } from '../models/LayoutWidget.js'

const { seed } = createModelHelpers(
  LayoutWidget, 'layout-widgets'
)

test(
  'buttonBasic: button visible with text',
  async ({ page, url }) => {
    const widgetId = await seed({
      sectionDetail: 'detail value'
    })

    await page.goto(
      `${url}/admin/layout/${widgetId}`
    )
    const button = page.locator(
      'button.dito-button'
    ).filter({ hasText: 'Click Me' })
    await expect(button).toBeVisible({ timeout: 15_000 })
  }
)

test(
  'submitBasic: submit button visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      sectionDetail: 'detail value'
    })

    await page.goto(
      `${url}/admin/layout/${widgetId}`
    )
    const button = page.locator(
      'button.dito-button[type="submit"]'
    ).filter({ hasText: 'Save' })
    await expect(button).toBeVisible({ timeout: 15_000 })
  }
)

test(
  'buttonDisabled: button is disabled',
  async ({ page, url }) => {
    const widgetId = await seed({
      sectionDetail: 'detail value'
    })

    await page.goto(
      `${url}/admin/layout/${widgetId}`
    )
    const button = page.locator(
      'button.dito-button'
    ).filter({ hasText: 'Disabled' })
    await expect(button).toBeVisible({ timeout: 15_000 })
    await expect(button).toBeDisabled()
  }
)
