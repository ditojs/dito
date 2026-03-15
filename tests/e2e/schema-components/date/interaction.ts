import {
  test, expect, createModelHelpers,
  getContainer
} from '../fixtures.js'
import { DateWidget } from '../models/DateWidget.js'

const { seed, saveAndFetch } = createModelHelpers(DateWidget, 'date-widgets')

test(
  'dateBasic: open calendar, click day, persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      dateBasic: '2026-03-14'
    })

    await page.goto(
      `${url}/admin/date/${widgetId}`
    )
    await expect(
      page.locator('input#dateBasic')
    ).toBeVisible({ timeout: 15_000 })

    const initial = await page.locator(
      'input#dateBasic'
    ).inputValue()

    // Open calendar and click a different day
    await page.locator('input#dateBasic').click()
    await expect(
      page.locator('.dito-calendar-popup')
    ).toBeVisible()

    await page.locator(
      '.dito-calendar-dates span'
    ).filter({ hasText: /^20$/ }).first().click()

    // Value should have changed
    await expect(
      page.locator('input#dateBasic')
    ).not.toHaveValue(initial)

    const widget = await saveAndFetch(
      page, widgetId
    )
    // Date should have changed from the seeded value
    expect(String(widget.dateBasic)).not.toContain(
      '2026-03-14'
    )
  }
)

test(
  'dateClearable: clear to null and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      dateClearable: '2026-01-01'
    })

    await page.goto(
      `${url}/admin/date/${widgetId}`
    )
    await expect(
      page.locator('input#dateClearable')
    ).toBeVisible({ timeout: 15_000 })

    const container = getContainer(
      page, 'dateClearable'
    )
    await container.hover()
    await container.locator(
      '.dito-affixes__clear'
    ).click()
    await expect(
      page.locator('input#dateClearable')
    ).toHaveValue('')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.dateClearable).toBeNull()
  }
)
