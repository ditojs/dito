import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { BooleanWidget } from '../models/BooleanWidget.js'

const { seed } = createModelHelpers(BooleanWidget, 'boolean-widgets')

test(
  'checkboxBasic: checkbox input visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      checkboxBasic: false
    })

    await page.goto(
      `${url}/admin/boolean/${widgetId}`
    )
    await expect(
      page.locator('input[type="checkbox"]').first()
    ).toBeVisible({ timeout: 15_000 })

    await test.step(
      'checkboxBasic: checkbox input visible',
      async () => {
        await expect(
          page.locator(
            'input[type="checkbox"]'
          ).first()
        ).toBeVisible()
      }
    )
  }
)
