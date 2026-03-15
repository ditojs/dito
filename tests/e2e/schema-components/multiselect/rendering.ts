import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { SelectWidget } from '../models/SelectWidget.js'

const { seed } = createModelHelpers(SelectWidget, 'select-widgets')

test(
  'select view: multiselect fields',
  async ({ page, url }) => {
    const widgetId = await seed({
      multiselectMultiple: ['alpha', 'beta']
    })

    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    await expect(
      page.locator('select').first()
    ).toBeVisible({ timeout: 15_000 })

    await test.step(
      'multiselectMultiple: two tags visible',
      async () => {
        const ms = page.locator(
          '.multiselect--multiple'
        ).first()
        await expect(
          ms.locator('.multiselect__tag')
        ).toHaveCount(2)
      }
    )
  }
)
