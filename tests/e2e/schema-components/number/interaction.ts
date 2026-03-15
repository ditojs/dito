import {
  test, expect, createModelHelpers,
  getInput, getContainer
} from '../fixtures.js'
import { NumberWidget } from '../models/NumberWidget.js'

const { seed, saveAndFetch } = createModelHelpers(NumberWidget, 'number-widgets')

test(
  'numberBasic: type new value',
  async ({ page, url }) => {
    const widgetId = await seed({
      numberBasic: 42
    })

    await page.goto(
      `${url}/admin/number/${widgetId}`
    )
    await expect(
      getInput(page, 'numberBasic')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(page, 'numberBasic')
    await input.fill('99')
    await input.blur()
    await expect(input).toHaveValue('99')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.numberBasic).toBe(99)
  }
)

test(
  'numberStep: arrow up/down by 5',
  async ({ page, url }) => {
    const widgetId = await seed({
      numberStep: 10
    })

    await page.goto(
      `${url}/admin/number/${widgetId}`
    )
    await expect(
      getInput(page, 'numberStep')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(page, 'numberStep')
    await input.focus()
    await page.keyboard.press('ArrowUp')
    await expect(input).toHaveValue('15')
    await page.keyboard.press('ArrowDown')
    await expect(input).toHaveValue('10')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.numberStep).toBe(10)
  }
)

test(
  'numberStepClearable: clear to null',
  async ({ page, url }) => {
    const widgetId = await seed({
      numberStepClearable: 15
    })

    await page.goto(
      `${url}/admin/number/${widgetId}`
    )
    await expect(
      getInput(page, 'numberStepClearable')
    ).toBeVisible({ timeout: 15_000 })

    const container = getContainer(
      page, 'numberStepClearable'
    )
    await container.hover()
    await container.locator(
      '.dito-affixes__clear'
    ).click()
    await expect(
      getInput(page, 'numberStepClearable')
    ).toHaveValue('')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.numberStepClearable).toBeNull()
  }
)

test(
  'numberStepFractional: arrow up by 0.25',
  async ({ page, url }) => {
    const widgetId = await seed({
      numberStepFractional: 1.75
    })

    await page.goto(
      `${url}/admin/number/${widgetId}`
    )
    await expect(
      getInput(page, 'numberStepFractional')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(
      page, 'numberStepFractional'
    )
    await input.focus()
    await page.keyboard.press('ArrowUp')
    await expect(input).toHaveValue('2')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.numberStepFractional).toBe(2)
  }
)
