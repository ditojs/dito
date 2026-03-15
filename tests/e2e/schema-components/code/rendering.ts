import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { TextareaWidget } from '../models/TextareaWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  TextareaWidget, 'textarea-widgets'
)

test(
  'codeBasic: .dito-code element visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      codeBasic: 'const x = 1'
    })
    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    await expect(
      page.locator('.dito-code#codeBasic')
    ).toBeVisible({ timeout: 15_000 })
  }
)

test(
  'codeResizable: .dito-resize handle visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      codeResizable: 'code content'
    })
    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    await expect(
      page.locator(
        '.dito-code#codeResizable .dito-resize'
      )
    ).toBeVisible({ timeout: 15_000 })
  }
)
