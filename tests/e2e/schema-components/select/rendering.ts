import {
  test, expect, createModelHelpers,
  getContainer
} from '../fixtures.js'
import { SelectWidget } from '../models/SelectWidget.js'

const { seed } = createModelHelpers(SelectWidget, 'select-widgets')

test(
  'selectString: native select with options',
  async ({ page, url }) => {
    const widgetId = await seed({
      selectString: 'beta'
    })
    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    const select = page.locator(
      'select[name="selectString"]'
    )
    await expect(select).toBeVisible({ timeout: 15_000 })
    await expect(
      select.locator('option')
    ).toHaveCount(3)
  }
)

test(
  'selectGroupBy: both options rendered',
  async ({ page, url }) => {
    const widgetId = await seed({
      selectGroupBy: 'a1'
    })
    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    const select = page.locator(
      'select[name="selectGroupBy"]'
    )
    await expect(select).toBeVisible({ timeout: 15_000 })
    await expect(
      select.locator('option')
    ).toHaveCount(2)
  }
)

test(
  'selectClearable: clear button visible on hover',
  async ({ page, url }) => {
    const widgetId = await seed({
      selectClearable: 'alpha'
    })
    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    const container = getContainer(page, 'selectClearable')
    await expect(container).toBeVisible({ timeout: 15_000 })
    await container.hover()
    await expect(
      container.locator('.dito-affixes__clear')
    ).toBeVisible()
  }
)

test(
  'selectPrefixSuffix: prefix and suffix visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      selectPrefixSuffix: 'alpha'
    })
    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    const container = getContainer(page, 'selectPrefixSuffix')
    await expect(container).toBeVisible({ timeout: 15_000 })
    await expect(
      container.locator('.dito-affix--text').first()
    ).toContainText('Pick:')
    await expect(
      container.locator('.dito-affix--text').last()
    ).toContainText('!')
  }
)
