import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { DateWidget } from '../models/DateWidget.js'

const { seed } = createModelHelpers(DateWidget, 'date-widgets')

test(
  'date view: time variants',
  async ({ page, url }) => {
    const widgetId = await seed({
      timeBasic: '14:30:00'
    })

    await page.goto(`${url}/admin/date/${widgetId}`)
    await expect(
      page.locator('input#timeBasic')
    ).toBeVisible({ timeout: 15_000 })

    await test.step(
      'timeBasic: input is visible',
      async () => {
        await expect(
          page.locator('input#timeBasic')
        ).toBeVisible()
      }
    )
  }
)
