import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { TextareaWidget } from '../models/TextareaWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  TextareaWidget, 'textarea-widgets'
)

test(
  'code interactions: type, persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      codeBasic: 'const x = 1'
    })

    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    await expect(
      page.locator('.dito-code').first()
    ).toBeVisible({ timeout: 15_000 })

    await test.step(
      'codeBasic: type code in editor',
      async () => {
        const code = page.locator(
          '.dito-code#codeBasic'
        )
        const textarea = code.locator('textarea')
        await textarea.focus()
        await page.keyboard.press('Meta+a')
        await page.keyboard.type(
          'const y = 2', { delay: 10 }
        )
      }
    )

    // --- Save and verify ---

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.codeBasic).toContain(
      'const y = 2'
    )
  }
)
