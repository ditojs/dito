import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { TextareaWidget } from '../models/TextareaWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  TextareaWidget, 'textarea-widgets'
)

test(
  'markupBasic: .dito-markup element visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      markupBasic: '<p>basic markup</p>'
    })
    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    await expect(
      page.locator('.dito-markup#markupBasic')
    ).toBeVisible({ timeout: 15_000 })
  }
)

test(
  'markupResizable: .dito-resize handle visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      markupResizable: '<p>resizable markup</p>'
    })
    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    await expect(
      page.locator(
        '.dito-markup#markupResizable .dito-resize'
      )
    ).toBeVisible({ timeout: 15_000 })
  }
)

test(
  'markupMarksSubset: toolbar has 2 mark buttons',
  async ({ page, url }) => {
    const widgetId = await seed({
      markupMarksSubset: '<p>marks subset</p>'
    })
    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    const markup = page.locator(
      '.dito-markup#markupMarksSubset'
    )
    await expect(markup).toBeVisible({ timeout: 15_000 })
    await expect(
      markup.locator('.dito-buttons--toolbar button')
    ).toHaveCount(2)
  }
)

test(
  'markupMarksAll: toolbar has 9 mark buttons',
  async ({ page, url }) => {
    const widgetId = await seed({
      markupMarksAll: '<p>marks all</p>'
    })
    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    const toolbar = page.locator(
      '.dito-markup#markupMarksAll .dito-buttons--toolbar'
    )
    await expect(toolbar).toBeVisible({ timeout: 15_000 })
    await expect(
      toolbar.locator('button')
    ).toHaveCount(9)
  }
)

test(
  'markupToolsHistory: undo and redo buttons visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      markupToolsHistory: '<p>tools history</p>'
    })
    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    const toolbar = page.locator(
      '.dito-markup#markupToolsHistory ' +
      '.dito-buttons--toolbar'
    )
    await expect(toolbar).toBeVisible({ timeout: 15_000 })
    await expect(
      toolbar.locator('button')
    ).toHaveCount(2)
  }
)
