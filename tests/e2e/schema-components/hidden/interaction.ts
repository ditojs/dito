import {
  test, expect, createModelHelpers,
  getInput
} from '../fixtures.js'
import { DataWidget } from '../models/DataWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  DataWidget, 'data-widgets'
)

test(
  'hidden component: hiddenCompute persists',
  async ({ page, url }) => {
    const widgetId = await seed({
      dataTextBasic: 'hello world'
    })

    await page.goto(
      `${url}/admin/data/${widgetId}`
    )
    await expect(
      getInput(page, 'dataTextBasic')
    ).toBeVisible({ timeout: 15_000 })

    await expect(
      page.locator('[id="hiddenCompute"]')
    ).not.toBeVisible()

    await getInput(
      page, 'dataTextBasic'
    ).fill('Test Value')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(
      widget.hiddenCompute
    ).toBe('TEST VALUE')
    expect(
      widget.dataTextBasic
    ).toBe('Test Value')
  }
)
