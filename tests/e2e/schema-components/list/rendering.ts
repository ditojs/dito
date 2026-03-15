import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { SourceWidget } from '../models/SourceWidget.js'

const { seed } = createModelHelpers(
  SourceWidget, 'source-widgets'
)

test(
  'listInlined: items rendered with create button',
  async ({ page, url }) => {
    const widgetId = await seed({
      listInlined: [
        { name: 'Item 1' },
        { name: 'Item 2' }
      ]
    })
    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    const list = page.locator('.dito-list#listInlined')
    await expect(list).toBeVisible({ timeout: 15_000 })
    await expect(
      list.locator('tbody tr')
    ).toHaveCount(2)
    await expect(
      list.locator('tfoot button')
    ).toBeVisible()
  }
)

test(
  'listColumns: table head with column header',
  async ({ page, url }) => {
    const widgetId = await seed({
      listColumns: [
        { name: 'Row 1' },
        { name: 'Row 2' }
      ]
    })
    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    const list = page.locator('.dito-list#listColumns')
    await expect(list).toBeVisible({ timeout: 15_000 })
    await expect(
      list.locator('thead th')
    ).toBeVisible()
    await expect(
      list.locator('tbody tr')
    ).toHaveCount(2)
  }
)

test(
  'listDeletable: remove button per row',
  async ({ page, url }) => {
    const widgetId = await seed({
      listDeletable: [{ name: 'Delete me' }]
    })
    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    const list = page.locator('.dito-list#listDeletable')
    await expect(list).toBeVisible({ timeout: 15_000 })
    await expect(
      list.locator('.dito-button--remove')
    ).toBeVisible()
  }
)

test(
  'listDraggable: drag handle visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      listDraggable: [
        { name: 'Drag 1' },
        { name: 'Drag 2' }
      ]
    })
    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    const list = page.locator('.dito-list#listDraggable')
    await expect(list).toBeVisible({ timeout: 15_000 })
    await expect(
      list.locator('.dito-button--drag')
    ).toHaveCount(2)
  }
)

test(
  'listEmpty: empty table body',
  async ({ page, url }) => {
    const widgetId = await seed({
      listEmpty: []
    })
    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    // Empty list may not be "visible" — wait for
    // the form to load by checking the submit button
    await expect(
      page.locator('button.dito-button[type="submit"]')
        .first()
    ).toBeVisible({ timeout: 15_000 })
    const list = page.locator('.dito-list#listEmpty')
    await expect(
      list.locator('tbody tr')
    ).toHaveCount(0)
  }
)
