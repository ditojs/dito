import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { SelectWidget } from '../models/SelectWidget.js'

const { seed, saveAndFetch } = createModelHelpers(SelectWidget, 'select-widgets')

test(
  'checkboxesVertical: uncheck alpha, check gamma, persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      checkboxesVertical: ['alpha', 'beta']
    })

    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    await expect(
      page.locator('#checkboxesVertical')
    ).toBeVisible({ timeout: 15_000 })

    const list = page.locator('#checkboxesVertical')
    await list.locator('label').filter(
      { hasText: 'alpha' }
    ).click()
    await list.locator('label').filter(
      { hasText: 'gamma' }
    ).click()

    const widget = await saveAndFetch(
      page, widgetId
    )
    // was [alpha, beta], unchecked alpha,
    // checked gamma → [beta, gamma]
    expect(
      widget.checkboxesVertical
    ).toEqual(
      expect.arrayContaining(['beta', 'gamma'])
    )
    expect(
      widget.checkboxesVertical
    ).not.toContain('alpha')
  }
)

test(
  'checkboxesHorizontal: check alpha and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      checkboxesHorizontal: ['gamma']
    })

    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    await expect(
      page.locator('#checkboxesHorizontal')
    ).toBeVisible({ timeout: 15_000 })

    const list = page.locator(
      '#checkboxesHorizontal'
    )
    await list.locator('label').filter(
      { hasText: 'alpha' }
    ).click()

    const widget = await saveAndFetch(
      page, widgetId
    )
    // was [gamma], checked alpha → [gamma, alpha]
    expect(
      widget.checkboxesHorizontal
    ).toEqual(
      expect.arrayContaining(['gamma', 'alpha'])
    )
  }
)
