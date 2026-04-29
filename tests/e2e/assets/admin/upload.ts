import path from 'path'
import {
  test, expect, fixturesDir
} from '../fixtures.js'
import { createModelHelpers } from '../../../utils/fixture-app.js'
import { DitoUploadField } from '../../../utils/pages.js'
import { AssetWidget } from '../models/AssetWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  AssetWidget, 'asset-widgets'
)

test.describe('upload', () => {
  // Warm the admin Vite bundle once per worker. The first
  // navigation to `/admin/assets/:id` triggers on-demand
  // compilation that can exceed per-test timeouts on CI
  // cold starts.
  test.beforeAll(async ({ browser, url }) => {
    const widgetId = await seed()
    const page = await browser.newPage()
    try {
      await page.goto(
        `${url}/admin/assets/${widgetId}`,
        { waitUntil: 'networkidle' }
      )
    } finally {
      await page.close()
    }
  })

  test(
    'single file appears in table',
    async ({ page, url }) => {
      const widgetId = await seed()
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      const upload = new DitoUploadField(page, 'files')
      await upload.waitUntilVisible({ timeout: 15_000 })

      await upload.upload(
        path.resolve(fixturesDir, 'tiny.png')
      )

      // Verify file row appears
      const row = upload.getRow(0)
      await expect(row).toBeVisible()
      await expect(row).toContainText('tiny.png')
      await expect(row).toContainText('Uploaded')
    }
  )

  test(
    'multiple files shows all rows',
    async ({ page, url }) => {
      const widgetId = await seed()
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      const upload = new DitoUploadField(page, 'files')
      await upload.waitUntilVisible({ timeout: 15_000 })

      await upload.upload(
        path.resolve(fixturesDir, 'tiny.png')
      )
      await upload.upload(
        path.resolve(fixturesDir, 'tiny.jpg')
      )

      await expect(upload.rows).toHaveCount(2)
      await expect(upload.getRow(0)).toContainText(
        'tiny.png'
      )
      await expect(upload.getRow(1)).toContainText(
        'tiny.jpg'
      )

      // Footer upload button always visible in
      // multiple mode
      await expect(upload.addButton).toBeVisible()
    }
  )

  test(
    'save persists file metadata to DB',
    async ({ page, url }) => {
      const widgetId = await seed()
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      const upload = new DitoUploadField(page, 'files')
      await upload.waitUntilVisible({ timeout: 15_000 })

      await upload.upload(
        path.resolve(fixturesDir, 'tiny.png')
      )
      await upload.upload(
        path.resolve(fixturesDir, 'tiny.jpg')
      )

      const widget = await saveAndFetch(
        page, widgetId
      )
      const files = widget.files as any[]
      expect(files).toHaveLength(2)

      for (const file of files) {
        expect(file).toHaveProperty('key')
        expect(file).toHaveProperty('name')
        expect(file).toHaveProperty('type')
        expect(file).toHaveProperty('size')
        expect(file).toHaveProperty('url')
        // upload tracking property stripped
        expect(file).not.toHaveProperty('upload')
      }

      expect(files[0].name).toBe('tiny.png')
      expect(files[0].type).toBe('image/png')
      expect(files[1].name).toBe('tiny.jpg')
      expect(files[1].type).toBe('image/jpeg')
    }
  )

  test(
    'reload shows Stored status',
    async ({ page, url }) => {
      const widgetId = await seed()
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      const upload = new DitoUploadField(page, 'files')
      await upload.waitUntilVisible({ timeout: 15_000 })

      await upload.upload(
        path.resolve(fixturesDir, 'tiny.png')
      )
      await saveAndFetch(page, widgetId)

      // Reload the page
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      await upload.waitUntilVisible({ timeout: 15_000 })

      const row = upload.getRow(0)
      await expect(row).toContainText('Stored')
      await expect(row).not.toContainText(
        'Uploaded'
      )
    }
  )
})
