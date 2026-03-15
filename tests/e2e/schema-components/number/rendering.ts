import {
  test, expect, createModelHelpers,
  getInput, getContainer
} from '../fixtures.js'
import { NumberWidget } from '../models/NumberWidget.js'

const { seed } = createModelHelpers(NumberWidget, 'number-widgets')

test(
  'numberBasic: renders number input with step="any"',
  async ({ page, url }) => {
    const widgetId = await seed({ numberBasic: 42 })
    await page.goto(`${url}/admin/number/${widgetId}`)
    const input = getInput(page, 'numberBasic')
    await expect(input).toBeVisible({ timeout: 15_000 })
    await expect(input).toHaveAttribute('type', 'number')
    await expect(input).toHaveAttribute('step', 'any')
  }
)

test(
  'numberStep: has step="5" attribute',
  async ({ page, url }) => {
    const widgetId = await seed({ numberStep: 10 })
    await page.goto(`${url}/admin/number/${widgetId}`)
    const input = getInput(page, 'numberStep')
    await expect(input).toBeVisible({ timeout: 15_000 })
    await expect(input).toHaveAttribute('step', '5')
  }
)

test(
  'numberStepClearable: clear button appears on hover',
  async ({ page, url }) => {
    const widgetId = await seed({
      numberStepClearable: 15
    })
    await page.goto(`${url}/admin/number/${widgetId}`)
    const container = getContainer(page, 'numberStepClearable')
    await expect(container).toBeVisible({ timeout: 15_000 })
    await container.hover()
    await expect(
      container.locator('.dito-affixes__clear')
    ).toBeVisible()
  }
)

test(
  'numberStepFractional: has step="0.25" attribute',
  async ({ page, url }) => {
    const widgetId = await seed({
      numberStepFractional: 1.75
    })
    await page.goto(`${url}/admin/number/${widgetId}`)
    const input = getInput(page, 'numberStepFractional')
    await expect(input).toBeVisible({ timeout: 15_000 })
    await expect(input).toHaveAttribute('step', '0.25')
  }
)

test(
  'numberPrefixSuffix: $ and USD visible in affixes',
  async ({ page, url }) => {
    const widgetId = await seed({
      numberPrefixSuffix: 99
    })
    await page.goto(`${url}/admin/number/${widgetId}`)
    const container = getContainer(page, 'numberPrefixSuffix')
    await expect(container).toBeVisible({ timeout: 15_000 })
    await expect(
      container.locator('.dito-affix--text').first()
    ).toContainText('$')
    await expect(
      container.locator('.dito-affix--text').last()
    ).toContainText('USD')
  }
)
