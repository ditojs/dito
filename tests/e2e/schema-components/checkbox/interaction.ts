import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { BooleanWidget } from '../models/BooleanWidget.js'

const { seed, saveAndFetch } = createModelHelpers(BooleanWidget, 'boolean-widgets')

test(
  'checkboxBasic: toggle on and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      checkboxBasic: false
    })

    await page.goto(
      `${url}/admin/boolean/${widgetId}`
    )
    const checkbox = page.locator(
      'input[type="checkbox"]'
    ).first()
    await expect(checkbox).toBeVisible(
      { timeout: 15_000 }
    )

    await expect(checkbox).not.toBeChecked()
    await checkbox.click()
    await expect(checkbox).toBeChecked()

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.checkboxBasic).toBe(true)
  }
)

test(
  'checkboxBasic: toggle off and back on',
  async ({ page, url }) => {
    const widgetId = await seed({
      checkboxBasic: true
    })

    await page.goto(
      `${url}/admin/boolean/${widgetId}`
    )
    const checkbox = page.locator(
      'input[type="checkbox"]'
    ).first()
    await expect(checkbox).toBeVisible(
      { timeout: 15_000 }
    )

    await expect(checkbox).toBeChecked()
    await checkbox.click()
    await expect(checkbox).not.toBeChecked()
    await checkbox.click()
    await expect(checkbox).toBeChecked()

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.checkboxBasic).toBe(true)
  }
)
