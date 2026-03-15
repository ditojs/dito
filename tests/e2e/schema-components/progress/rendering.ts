import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { SliderWidget } from '../models/SliderWidget.js'

const { seed } = createModelHelpers(SliderWidget, 'slider-widgets')

test(
  'progressBasic: progress element is visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      progressBasic: 60
    })

    await page.goto(`${url}/admin/slider/${widgetId}`)
    await expect(
      page.locator('progress#progressBasic')
    ).toBeVisible({ timeout: 15_000 })
  }
)

test(
  'progressRange: progress element is visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      progressRange: 50
    })

    await page.goto(`${url}/admin/slider/${widgetId}`)
    await expect(
      page.locator('progress#progressRange')
    ).toBeVisible({ timeout: 15_000 })
  }
)

test(
  'progressStep: progress element is visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      progressStep: 70
    })

    await page.goto(`${url}/admin/slider/${widgetId}`)
    await expect(
      page.locator('progress#progressStep')
    ).toBeVisible({ timeout: 15_000 })
  }
)

test(
  'progressNull: progress element is indeterminate',
  async ({ page, url }) => {
    // progressNull intentionally not seeded (remains null)
    const widgetId = await seed({})

    await page.goto(`${url}/admin/slider/${widgetId}`)
    const progress = page.locator('progress#progressNull')
    await expect(progress).toBeVisible({ timeout: 15_000 })
    await expect(progress).toHaveAttribute('value', '')
  }
)
