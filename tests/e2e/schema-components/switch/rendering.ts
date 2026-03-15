import {
  test, expect, createModelHelpers,
  getContainer
} from '../fixtures.js'
import { BooleanWidget } from '../models/BooleanWidget.js'

const { seed } = createModelHelpers(BooleanWidget, 'boolean-widgets')

test('switchBasic: .dito-switch element visible', async ({ page, url }) => {
  const widgetId = await seed({ switchBasic: true })
  await page.goto(`${url}/admin/boolean/${widgetId}`)
  await expect(
    page.locator('input[type="checkbox"]').first()
  ).toBeVisible({ timeout: 15_000 })

  const switchEl = getContainer(page, 'switchBasic')
  await expect(switchEl).toHaveClass(/dito-switch/)
})

test(
  'switchLabels: shows unchecked label; toggle shows checked label',
  async ({ page, url }) => {
    const widgetId = await seed({ switchLabels: false })
    await page.goto(`${url}/admin/boolean/${widgetId}`)
    await expect(
      page.locator('input[type="checkbox"]').first()
    ).toBeVisible({ timeout: 15_000 })

    const switchEl = getContainer(page, 'switchLabels')
    await expect(switchEl).toBeVisible()
    await expect(
      switchEl.locator('.dito-switch__label')
    ).toContainText('No')

    await page.locator('#switchLabels').click()
    await expect(
      switchEl.locator('.dito-switch__label')
    ).toContainText('Yes')
  }
)
