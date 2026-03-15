import {
  test, expect, createModelHelpers,
  getContainer
} from '../fixtures.js'
import { DateWidget } from '../models/DateWidget.js'

const { seed } = createModelHelpers(DateWidget, 'date-widgets')

test(
  'dateBasic: input is visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      dateBasic: '2026-03-14'
    })

    await page.goto(`${url}/admin/date/${widgetId}`)
    await expect(
      page.locator('input#dateBasic')
    ).toBeVisible({ timeout: 15_000 })
  }
)

test(
  'dateClearable: clear button visible on hover',
  async ({ page, url }) => {
    const widgetId = await seed({
      dateClearable: '2026-01-01'
    })

    await page.goto(`${url}/admin/date/${widgetId}`)
    const container = getContainer(page, 'dateClearable')
    await expect(
      container.locator('input')
    ).toBeVisible({ timeout: 15_000 })
    await container.hover()
    await expect(
      container.locator('.dito-affixes__clear')
    ).toBeVisible()
  }
)

test(
  'datePrefix: prefix text "From:" visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      datePrefix: '2026-06-15'
    })

    await page.goto(`${url}/admin/date/${widgetId}`)
    const container = getContainer(page, 'datePrefix')
    await expect(
      container.locator('input')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      container.locator('.dito-affix--text')
    ).toContainText('From:')
  }
)
