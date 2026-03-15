import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { SourceWidget } from '../models/SourceWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  SourceWidget, 'source-widgets'
)

test(
  'listInlined: add item',
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
    await expect(
      page.locator('.dito-list').first()
    ).toBeVisible({ timeout: 15_000 })

    const list = page.locator(
      '.dito-list#listInlined'
    )
    await list.locator('tfoot button').click()
    await expect(
      list.locator('tbody tr')
    ).toHaveCount(3)
    const newInput = list.locator(
      'tbody tr'
    ).last().locator('input')
    await newInput.fill('Item 3')

    const { listInlined } = await saveAndFetch(
      page, widgetId
    )
    expect(listInlined!).toHaveLength(3)
    expect(
      listInlined![2].name
    ).toBe('Item 3')
  }
)

test(
  'listDeletable: remove item',
  async ({ page, url }) => {
    const widgetId = await seed({
      listDeletable: [
        { name: 'Delete me' }
      ]
    })

    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    await expect(
      page.locator('.dito-list').first()
    ).toBeVisible({ timeout: 15_000 })

    const list = page.locator(
      '.dito-list#listDeletable'
    )
    page.once('dialog', d => d.accept())
    await list.locator(
      '.dito-button--remove'
    ).click()
    await expect(
      list.locator('tbody tr')
    ).toHaveCount(0)

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.listDeletable).toHaveLength(0)
  }
)

test(
  'listDraggable: verify drag handles and order',
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
    await expect(
      page.locator('.dito-list').first()
    ).toBeVisible({ timeout: 15_000 })

    const list = page.locator(
      '.dito-list#listDraggable'
    )
    await expect(
      list.locator('.dito-button--drag')
    ).toHaveCount(2)

    await expect(
      list.locator('tbody tr').first()
        .locator('input')
    ).toHaveValue('Drag 1')
    await expect(
      list.locator('tbody tr').nth(1)
        .locator('input')
    ).toHaveValue('Drag 2')

  }
)
