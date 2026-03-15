import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { TextareaWidget } from '../models/TextareaWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  TextareaWidget, 'textarea-widgets'
)

test(
  'textareaBasic: type new content and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      textareaBasic: 'basic textarea content'
    })

    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    await expect(
      page.locator('textarea').first()
    ).toBeVisible({ timeout: 15_000 })

    const textarea = page.locator(
      'textarea[name="textareaBasic"]'
    )
    await textarea.fill('updated content')
    await expect(textarea).toHaveValue(
      'updated content'
    )

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.textareaBasic).toBe('updated content')
  }
)

test(
  'textareaTrim: whitespace-only trims to null and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      textareaTrim: ''
    })

    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    await expect(
      page.locator('textarea').first()
    ).toBeVisible({ timeout: 15_000 })

    const textarea = page.locator(
      'textarea[name="textareaTrim"]'
    )
    await textarea.fill('   ')
    await textarea.blur()

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.textareaTrim).toBeNull()
  }
)
