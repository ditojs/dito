import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { DateWidget } from '../models/DateWidget.js'

const { seed } = createModelHelpers(DateWidget, 'date-widgets')

test(
  'date view: datetime variants',
  async ({ page, url }) => {
    const widgetId = await seed({
      datetimeBasic: '2026-03-14T10:30:00.000Z'
    })

    await page.goto(`${url}/admin/date/${widgetId}`)
    await expect(
      page.locator('input#datetimeBasic')
    ).toBeVisible({ timeout: 15_000 })

    await test.step(
      'datetimeBasic: input is visible',
      async () => {
        await expect(
          page.locator('input#datetimeBasic')
        ).toBeVisible()
      }
    )
  }
)
