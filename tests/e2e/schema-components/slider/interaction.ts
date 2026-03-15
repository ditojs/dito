import {
  test, expect, createModelHelpers,
  getContainer
} from '../fixtures.js'
import { SliderWidget } from '../models/SliderWidget.js'

const { seed, saveAndFetch } = createModelHelpers(SliderWidget, 'slider-widgets')

test(
  'sliderBasic: drag + number sync + type',
  async ({ page, url }) => {
    const widgetId = await seed({
      sliderBasic: 50
    })

    await page.goto(
      `${url}/admin/slider/${widgetId}`
    )
    await expect(
      page.locator('input[type="range"]').first()
    ).toBeVisible({ timeout: 15_000 })

    const container = getContainer(
      page, 'sliderBasic'
    )
    const range = container.locator(
      'input[type="range"]'
    )

    const box = await range.boundingBox()
    expect(box).toBeTruthy()
    // Click at ~75% position
    const endX = box!.x + box!.width * 0.75
    const y = box!.y + box!.height / 2
    await page.mouse.click(endX, y)
    // Value should be > 50 (was 50, dragged right)
    const val = Number(await range.inputValue())
    expect(val).toBeGreaterThan(50)

    // Number input should be synced after drag
    const numberInput = container.locator(
      '.dito-number input'
    )
    await expect(numberInput).toHaveValue(
      String(val)
    )

    // Type in number input → range syncs
    await numberInput.fill('80')
    await numberInput.blur()
    await expect(
      container.locator('input[type="range"]')
    ).toHaveValue('80')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.sliderBasic).toBe(80)
  }
)

test(
  'sliderNoInput: drag only',
  async ({ page, url }) => {
    const widgetId = await seed({
      sliderNoInput: 30
    })

    await page.goto(
      `${url}/admin/slider/${widgetId}`
    )
    await expect(
      page.locator('input[type="range"]').first()
    ).toBeVisible({ timeout: 15_000 })

    const container = getContainer(
      page, 'sliderNoInput'
    )
    const range = container.locator(
      'input[type="range"]'
    )

    const box = await range.boundingBox()
    expect(box).toBeTruthy()
    const x = box!.x + box!.width * 0.7
    const y = box!.y + box!.height / 2
    await page.mouse.click(x, y)
    const val = Number(await range.inputValue())
    expect(val).toBeGreaterThan(30)

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.sliderNoInput).toBeGreaterThan(30)
  }
)

test(
  'sliderStep: drag snaps + number match',
  async ({ page, url }) => {
    const widgetId = await seed({
      sliderStep: 40
    })

    await page.goto(
      `${url}/admin/slider/${widgetId}`
    )
    await expect(
      page.locator('input[type="range"]').first()
    ).toBeVisible({ timeout: 15_000 })

    const container = getContainer(
      page, 'sliderStep'
    )
    const range = container.locator(
      'input[type="range"]'
    )

    const box = await range.boundingBox()
    expect(box).toBeTruthy()
    const x = box!.x + box!.width * 0.65
    const y = box!.y + box!.height / 2
    await page.mouse.click(x, y)
    // Value should snap to nearest 10
    const val = Number(await range.inputValue())
    expect(val % 10).toBe(0)

    // Number input should match range value
    const numberInput = container.locator(
      '.dito-number input'
    )
    await expect(numberInput).toHaveValue(
      String(val)
    )

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.sliderStep! % 10).toBe(0)
  }
)

test(
  'sliderDecimals: type decimal',
  async ({ page, url }) => {
    const widgetId = await seed({
      sliderDecimals: 0.5
    })

    await page.goto(
      `${url}/admin/slider/${widgetId}`
    )
    await expect(
      page.locator('input[type="range"]').first()
    ).toBeVisible({ timeout: 15_000 })

    const container = getContainer(
      page, 'sliderDecimals'
    )
    const numberInput = container.locator(
      '.dito-number input'
    )
    await numberInput.fill('0.7')
    await numberInput.blur()
    await expect(numberInput).toHaveValue('0.7')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.sliderDecimals).toBe(0.7)
  }
)

test(
  'sliderRange: type value',
  async ({ page, url }) => {
    const widgetId = await seed({
      sliderRange: 25
    })

    await page.goto(
      `${url}/admin/slider/${widgetId}`
    )
    await expect(
      page.locator('input[type="range"]').first()
    ).toBeVisible({ timeout: 15_000 })

    const container = getContainer(
      page, 'sliderRange'
    )
    const numberInput = container.locator(
      '.dito-number input'
    )
    await numberInput.fill('35')
    await numberInput.blur()
    await expect(numberInput).toHaveValue('35')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.sliderRange).toBe(35)
  }
)
