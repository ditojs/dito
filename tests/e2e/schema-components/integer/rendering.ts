import {
  test, expect, createModelHelpers,
  getInput
} from '../fixtures.js'
import { NumberWidget } from '../models/NumberWidget.js'

const { seed } = createModelHelpers(NumberWidget, 'number-widgets')

test('integerBasic: renders number input', async ({ page, url }) => {
  const widgetId = await seed({ integerBasic: 7 })
  await page.goto(`${url}/admin/number/${widgetId}`)
  await expect(
    getInput(page, 'integerBasic')
  ).toBeVisible({ timeout: 15_000 })

  await expect(
    getInput(page, 'integerBasic')
  ).toHaveAttribute('type', 'number')
})

test('integerStep: has step="3" attribute', async ({ page, url }) => {
  const widgetId = await seed({ integerStep: 6 })
  await page.goto(`${url}/admin/number/${widgetId}`)
  await expect(
    getInput(page, 'integerStep')
  ).toBeVisible({ timeout: 15_000 })

  await expect(
    getInput(page, 'integerStep')
  ).toHaveAttribute('step', '3')
})
