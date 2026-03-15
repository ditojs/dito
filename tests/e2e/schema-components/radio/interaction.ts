import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { SelectWidget } from '../models/SelectWidget.js'

const { seed, saveAndFetch } = createModelHelpers(SelectWidget, 'select-widgets')

test(
  'radioVertical: select gamma and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      radioVertical: 'beta'
    })

    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    await expect(
      page.locator('#radioVertical')
    ).toBeVisible({ timeout: 15_000 })

    const list = page.locator('#radioVertical')
    await list.locator('label').filter(
      { hasText: 'gamma' }
    ).click()

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.radioVertical).toBe('gamma')
  }
)

test(
  'radioHorizontal: select beta and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      radioHorizontal: 'alpha'
    })

    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    await expect(
      page.locator('#radioHorizontal')
    ).toBeVisible({ timeout: 15_000 })

    const list = page.locator('#radioHorizontal')
    await list.locator('label').filter(
      { hasText: 'beta' }
    ).click()

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.radioHorizontal).toBe('beta')
  }
)
