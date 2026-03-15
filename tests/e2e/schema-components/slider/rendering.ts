import {
  test, expect, createModelHelpers,
  getContainer
} from '../fixtures.js'
import { SliderWidget } from '../models/SliderWidget.js'

const { seed } = createModelHelpers(SliderWidget, 'slider-widgets')

test(
  'sliderBasic: range input and number input visible',
  async ({ page, url }) => {
    const widgetId = await seed({ sliderBasic: 50 })
    await page.goto(`${url}/admin/slider/${widgetId}`)
    const container = getContainer(page, 'sliderBasic')
    await expect(
      container.locator('input[type="range"]')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      container.locator('.dito-number')
    ).toBeVisible()
  }
)

test(
  'sliderNoInput: range input visible, number input hidden',
  async ({ page, url }) => {
    const widgetId = await seed({ sliderNoInput: 30 })
    await page.goto(`${url}/admin/slider/${widgetId}`)
    const container = getContainer(page, 'sliderNoInput')
    await expect(
      container.locator('input[type="range"]')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      container.locator('.dito-number')
    ).not.toBeVisible()
  }
)

test(
  'sliderStep: range input has step="10" attribute',
  async ({ page, url }) => {
    const widgetId = await seed({ sliderStep: 40 })
    await page.goto(`${url}/admin/slider/${widgetId}`)
    const input = getContainer(page, 'sliderStep')
      .locator('input[type="range"]')
    await expect(input).toBeVisible({ timeout: 15_000 })
    await expect(input).toHaveAttribute('step', '10')
  }
)

test(
  'sliderRange: range input is visible',
  async ({ page, url }) => {
    const widgetId = await seed({ sliderRange: 25 })
    await page.goto(`${url}/admin/slider/${widgetId}`)
    await expect(
      getContainer(page, 'sliderRange')
        .locator('input[type="range"]')
    ).toBeVisible({ timeout: 15_000 })
  }
)

test(
  'sliderDecimals: range input has step="0.1" attribute',
  async ({ page, url }) => {
    const widgetId = await seed({ sliderDecimals: 0.5 })
    await page.goto(`${url}/admin/slider/${widgetId}`)
    const input = getContainer(page, 'sliderDecimals')
      .locator('input[type="range"]')
    await expect(input).toBeVisible({ timeout: 15_000 })
    await expect(input).toHaveAttribute('step', '0.1')
  }
)
