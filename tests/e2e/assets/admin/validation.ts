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

test.describe('validation', () => {
  test(
    'reject wrong extension',
    async ({ page, url }) => {
      const widgetId = await seed()
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      // Upload .txt to the files component. Bypass DitoUploadField.upload()
      // because the file is rejected client-side, so no /upload/ response
      // ever fires for it to await.
      const upload = new DitoUploadField(page, 'files')
      await upload.waitUntilVisible({ timeout: 15_000 })

      await upload.container.locator(
        'input[type="file"]'
      ).setInputFiles(
        path.resolve(fixturesDir, 'invalid.txt')
      )

      // Should show error notification
      const notification = page.locator(
        '.dito-notification'
      )
      await expect(notification).toContainText(
        'Unsupported file-type'
      )
      await expect(notification).toContainText(
        'invalid.txt'
      )

      // No file row should appear
      await expect(upload.rows).toHaveCount(0)
    }
  )

  test(
    'reject oversized file',
    async ({ page, url }) => {
      const widgetId = await seed()
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      // Upload to the filesSmall component
      // (maxSize: 100b) — tiny.jpg (285b) exceeds
      // this. Bypass DitoUploadField.upload() because
      // the file is rejected client-side, so no
      // /upload/ response ever fires.
      const upload = new DitoUploadField(page, 'filesSmall')
      await upload.waitUntilVisible({ timeout: 15_000 })

      await upload.container.locator(
        'input[type="file"]'
      ).setInputFiles(
        path.resolve(fixturesDir, 'tiny.jpg')
      )

      const notification = page.locator(
        '.dito-notification'
      )
      await expect(notification).toContainText(
        'File is too large'
      )
    }
  )
})
