import path from 'path'
import {
  test,
  expect,
  fixturesDir
} from '../fixtures.js'
import { createModelHelpers } from '../../../utils/fixture-app.js'
import { DitoUploadField } from '../../../utils/pages.js'
import { AssetWidget } from '../models/AssetWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  AssetWidget,
  'asset-widgets'
)

test.describe('drag reorder', () => {
  test('drag handle visible with 2+ files', async ({ page, url }) => {
    const widgetId = await seed()
    await page.goto(
      `${url}/admin/assets/${widgetId}`
    )
    const upload = new DitoUploadField(page, 'files')
    await upload.waitUntilVisible()

    // Upload one file — no drag handle
    await upload.upload(
      path.resolve(fixturesDir, 'tiny.png')
    )
    await expect(
      upload.container.locator('.dito-button--drag')
    ).toHaveCount(0)

    // Upload second file — drag handles appear
    await upload.upload(
      path.resolve(fixturesDir, 'tiny.jpg')
    )
    await expect(
      upload.container.locator('.dito-button--drag')
    ).toHaveCount(2)
  })

  test('reorder via drag handle and persist', async ({ page, url }) => {
    const widgetId = await seed()
    await page.goto(
      `${url}/admin/assets/${widgetId}`
    )
    const upload = new DitoUploadField(page, 'files')
    await upload.waitUntilVisible()

    await upload.upload(
      path.resolve(fixturesDir, 'tiny.png')
    )
    await upload.upload(
      path.resolve(fixturesDir, 'tiny.jpg')
    )

    // Verify initial order
    await expect(upload.getRow(0)).toContainText(
      'tiny.png'
    )
    await expect(upload.getRow(1)).toContainText(
      'tiny.jpg'
    )

    // Hover the first file to show its drag handle, and move it down with the
    // keyboard, which moves it through the data model like dropping it there
    // does:
    const row = upload.getRow(0)
    await row.hover()
    await row.locator('.dito-button--drag').press('Alt+ArrowDown')

    // Verify new order in DOM
    await expect(upload.getRow(0)).toContainText(
      'tiny.jpg'
    )
    await expect(upload.getRow(1)).toContainText(
      'tiny.png'
    )

    // Save and verify DB order
    const widget = await saveAndFetch(
      page,
      widgetId
    )
    const files = widget.files as any[]
    expect(files[0].name).toBe('tiny.jpg')
    expect(files[1].name).toBe('tiny.png')
  })
})
