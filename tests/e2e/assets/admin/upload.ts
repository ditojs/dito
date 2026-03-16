import path from 'path'
import {
  test, expect, createModelHelpers,
  uploadFile, fixturesDir
} from '../fixtures.js'
import { AssetWidget } from '../models/AssetWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  AssetWidget, 'asset-widgets'
)

test.describe('upload', () => {
  test(
    'single file appears in table',
    async ({ page, url }) => {
      const widgetId = await seed()
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      // Wait for the form to load — scope to
      // the upload component for 'files' to avoid
      // matching other upload components on the page.
      // The id is on the hidden file input, not the
      // .dito-upload root, so use :has() to scope.
      const upload = page.locator(
        '.dito-upload:has(input#files)'
      )
      await expect(upload).toBeVisible(
        { timeout: 15_000 }
      )

      await uploadFile(
        page,
        path.resolve(fixturesDir, 'tiny.png')
      )

      // Verify file row appears
      const row = upload.locator('tbody tr').first()
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
      const upload = page.locator(
        '.dito-upload:has(input#files)'
      )
      await expect(upload).toBeVisible(
        { timeout: 15_000 }
      )

      await uploadFile(
        page,
        path.resolve(fixturesDir, 'tiny.png')
      )
      await uploadFile(
        page,
        path.resolve(fixturesDir, 'tiny.jpg')
      )

      const rows = upload.locator('tbody tr')
      await expect(rows).toHaveCount(2)
      await expect(rows.nth(0)).toContainText(
        'tiny.png'
      )
      await expect(rows.nth(1)).toContainText(
        'tiny.jpg'
      )

      // Footer upload button always visible in
      // multiple mode
      await expect(
        upload.locator(
          'tfoot .dito-button--upload'
        )
      ).toBeVisible()
    }
  )

  test(
    'save persists file metadata to DB',
    async ({ page, url }) => {
      const widgetId = await seed()
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      const upload = page.locator(
        '.dito-upload:has(input#files)'
      )
      await expect(upload).toBeVisible(
        { timeout: 15_000 }
      )

      await uploadFile(
        page,
        path.resolve(fixturesDir, 'tiny.png')
      )
      await uploadFile(
        page,
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
      const upload = page.locator(
        '.dito-upload:has(input#files)'
      )
      await expect(upload).toBeVisible(
        { timeout: 15_000 }
      )

      await uploadFile(
        page,
        path.resolve(fixturesDir, 'tiny.png')
      )
      await saveAndFetch(page, widgetId)

      // Reload the page
      await page.goto(
        `${url}/admin/assets/${widgetId}`
      )
      await expect(upload).toBeVisible(
        { timeout: 15_000 }
      )

      const row = upload.locator('tbody tr').first()
      await expect(row).toContainText('Stored')
      await expect(row).not.toContainText(
        'Uploaded'
      )
    }
  )
})
