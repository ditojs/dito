import path from 'path'
import {
  test, expect, fixturesDir
} from '../fixtures.js'
import { createModelHelpers } from '../../../utils/fixture-app.js'
import { DitoUploadField } from '../../../utils/pages.js'
import { AssetWidget } from '../models/AssetWidget.js'

const { seed } = createModelHelpers(
  AssetWidget, 'asset-widgets'
)

test.describe('single mode', () => {
  test(
    'per-row upload button replaces file',
    async ({ page, url }) => {
      const widgetId = await seed()
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      const upload = new DitoUploadField(page, 'file')
      await upload.waitUntilVisible({ timeout: 15_000 })

      // Upload initial file
      await upload.upload(
        path.resolve(fixturesDir, 'tiny.png')
      )

      // Verify file row
      await expect(upload.rows).toHaveCount(1)
      await expect(upload.rows).toContainText('tiny.png')

      // Per-row upload button should exist
      const rowUploadBtn = upload.container.locator(
        'tbody .dito-button--upload'
      )
      await expect(rowUploadBtn).toBeVisible()

      // Use per-row button to replace
      await upload.upload(
        path.resolve(fixturesDir, 'tiny.jpg')
      )

      // Should still have exactly 1 row
      await expect(upload.rows).toHaveCount(1)
      await expect(upload.rows).toContainText('tiny.jpg')
    }
  )

  test(
    'footer upload hidden when file exists',
    async ({ page, url }) => {
      const widgetId = await seed()
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      const upload = new DitoUploadField(page, 'file')
      await upload.waitUntilVisible({ timeout: 15_000 })

      // No file: footer upload button visible
      await expect(upload.addButton).toBeVisible()

      // Upload a file
      await upload.upload(
        path.resolve(fixturesDir, 'tiny.png')
      )

      // Footer upload button should be hidden
      await expect(upload.addButton).not.toBeVisible()
    }
  )
})
