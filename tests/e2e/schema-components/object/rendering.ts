import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { SourceWidget } from '../models/SourceWidget.js'

const { seed } = createModelHelpers(
  SourceWidget, 'source-widgets'
)

test('objectInline: object fields visible', async ({ page, url }) => {
  const widgetId = await seed({
    objectInline: { key: 'myKey', val: 'myVal' }
  })
  await page.goto(`${url}/admin/source/${widgetId}`)
  await expect(
    page.locator('.dito-object').first()
  ).toBeVisible({ timeout: 15_000 })

  await expect(
    page.locator('.dito-object#objectInline')
  ).toBeVisible()
})

test('objectCreatable: add button visible', async ({ page, url }) => {
  const widgetId = await seed({})
  await page.goto(`${url}/admin/source/${widgetId}`)
  await expect(
    page.locator('.dito-object').first()
  ).toBeVisible({ timeout: 15_000 })

  await expect(
    page.locator(
      '.dito-object#objectCreatable .dito-button--add'
    )
  ).toBeVisible()
})
