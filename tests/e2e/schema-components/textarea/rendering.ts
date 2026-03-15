import {
  test, expect, createModelHelpers,
  getContainer
} from '../fixtures.js'
import { TextareaWidget } from '../models/TextareaWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  TextareaWidget, 'textarea-widgets'
)

test(
  'textareaBasic: renders textarea with rows="4"',
  async ({ page, url }) => {
    const widgetId = await seed({
      textareaBasic: 'basic textarea content'
    })

    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    const textarea = page.locator(
      'textarea[name="textareaBasic"]'
    )
    await expect(textarea).toBeVisible({ timeout: 15_000 })
    await expect(textarea).toHaveAttribute('rows', '4')
  }
)

test(
  'textareaLines: has rows="8"',
  async ({ page, url }) => {
    const widgetId = await seed({
      textareaLines: 'multi-line content'
    })

    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    const textarea = page.locator(
      'textarea[name="textareaLines"]'
    )
    await expect(textarea).toBeVisible({ timeout: 15_000 })
    await expect(textarea).toHaveAttribute('rows', '8')
  }
)

test(
  'textareaResizable: has resizable class',
  async ({ page, url }) => {
    const widgetId = await seed({
      textareaResizable: 'resizable content'
    })

    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    await expect(
      page.locator('textarea[name="textareaResizable"]')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getContainer(page, 'textareaResizable')
        .locator('.dito-textarea--resizable')
    ).toBeVisible()
  }
)
