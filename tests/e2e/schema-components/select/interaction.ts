import {
  test, expect, createModelHelpers,
  getContainer
} from '../fixtures.js'
import { SelectWidget } from '../models/SelectWidget.js'

const { seed, saveAndFetch } = createModelHelpers(SelectWidget, 'select-widgets')

test(
  'selectString: change to gamma',
  async ({ page, url }) => {
    const widgetId = await seed({
      selectString: 'beta'
    })

    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    await expect(
      page.locator('select').first()
    ).toBeVisible({ timeout: 15_000 })

    const select = page.locator(
      'select[name="selectString"]'
    )
    await select.selectOption('gamma')
    await expect(select).toHaveValue('gamma')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.selectString).toBe('gamma')
  }
)

test(
  'selectLabelValue: select by label',
  async ({ page, url }) => {
    const widgetId = await seed({
      selectLabelValue: 'a'
    })

    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    await expect(
      page.locator('select').first()
    ).toBeVisible({ timeout: 15_000 })

    const select = page.locator(
      'select[name="selectLabelValue"]'
    )
    await select.selectOption({ label: 'Beta' })
    await expect(select).toHaveValue('b')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.selectLabelValue).toBe('b')
  }
)

test(
  'selectClearable: clear to null',
  async ({ page, url }) => {
    const widgetId = await seed({
      selectClearable: 'alpha'
    })

    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    await expect(
      page.locator('select').first()
    ).toBeVisible({ timeout: 15_000 })

    const container = getContainer(
      page, 'selectClearable'
    )
    await container.hover()
    await container.locator(
      '.dito-affixes__clear'
    ).click()

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.selectClearable).toBeNull()
  }
)
