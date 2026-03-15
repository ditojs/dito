import {
  test, expect, createModelHelpers,
  getContainer
} from '../fixtures.js'
import { BooleanWidget } from '../models/BooleanWidget.js'

const { seed, saveAndFetch } = createModelHelpers(BooleanWidget, 'boolean-widgets')

test(
  'switchBasic: toggle on and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      switchBasic: false
    })

    await page.goto(
      `${url}/admin/boolean/${widgetId}`
    )
    await expect(
      page.locator('input[type="checkbox"]').first()
    ).toBeVisible({ timeout: 15_000 })

    const input = page.locator('#switchBasic')
    await expect(input).not.toBeChecked()
    await input.click()
    await expect(input).toBeChecked()

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.switchBasic).toBe(true)
  }
)

test(
  'switchLabels: toggle changes label text and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      switchLabels: false
    })

    await page.goto(
      `${url}/admin/boolean/${widgetId}`
    )
    await expect(
      page.locator('input[type="checkbox"]').first()
    ).toBeVisible({ timeout: 15_000 })

    await expect(
      getContainer(page, 'switchLabels')
        .locator('.dito-switch__label')
    ).toContainText('No')
    await page.locator('#switchLabels').click()
    await expect(
      getContainer(page, 'switchLabels')
        .locator('.dito-switch__label')
    ).toContainText('Yes')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.switchLabels).toBe(true)
  }
)
