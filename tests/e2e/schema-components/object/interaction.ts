import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { SourceWidget } from '../models/SourceWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  SourceWidget, 'source-widgets'
)

test(
  'objectInline: edit field value and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      objectInline: { key: 'myKey', val: 'myVal' }
    })

    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    await expect(
      page.locator('.dito-object').first()
    ).toBeVisible({ timeout: 15_000 })

    const obj = page.locator(
      '.dito-object#objectInline'
    )
    const inputs = obj.locator('input')
    await inputs.first().fill('editedKey')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.objectInline!.key).toBe('editedKey')
  }
)

test(
  'objectCreatable: create object and persist',
  async ({ page, url }) => {
    // objectCreatable intentionally null initially
    const widgetId = await seed({})

    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    await expect(
      page.locator('.dito-object').first()
    ).toBeVisible({ timeout: 15_000 })

    const obj = page.locator(
      '.dito-object#objectCreatable'
    )
    await obj.locator('.dito-button--add').click()
    const input = obj.locator('input')
    await expect(input).toBeVisible()
    await input.fill('created-value')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.objectCreatable).not.toBeNull()
  }
)
