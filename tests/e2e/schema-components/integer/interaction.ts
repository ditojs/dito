import {
  test, expect, createModelHelpers,
  getInput
} from '../fixtures.js'
import { NumberWidget } from '../models/NumberWidget.js'

const { seed, saveAndFetch } = createModelHelpers(NumberWidget, 'number-widgets')

test(
  'integerBasic: type new value and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      integerBasic: 7
    })

    await page.goto(
      `${url}/admin/number/${widgetId}`
    )
    await expect(
      getInput(page, 'integerBasic')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(page, 'integerBasic')
    await input.fill('12')
    await input.blur()
    await expect(input).toHaveValue('12')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.integerBasic).toBe(12)
  }
)

test(
  'integerStep: arrow up by step and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      integerStep: 6
    })

    await page.goto(
      `${url}/admin/number/${widgetId}`
    )
    await expect(
      getInput(page, 'integerStep')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(page, 'integerStep')
    await input.focus()
    await page.keyboard.press('ArrowUp')
    await expect(input).toHaveValue('9')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.integerStep).toBe(9)
  }
)
