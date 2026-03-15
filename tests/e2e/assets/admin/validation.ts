import path from 'path'
import {
  test, expect, createModelHelpers,
  fixturesDir
} from '../fixtures.js'
import { AssetWidget } from '../models/AssetWidget.js'

const { seed } = createModelHelpers(
  AssetWidget, 'asset-widgets'
)

test(
  'A12: reject wrong extension',
  async ({ page, url }) => {
    const widgetId = await seed()
    await page.goto(
      `${url}/admin/assets/${widgetId}`
    )
    await expect(
      page.locator('.dito-upload').first()
    ).toBeVisible({ timeout: 15_000 })

    // Upload .txt to the files component
    const upload = page.locator(
      '.dito-upload:has(input#files)'
    )
    const fileInput = upload.locator(
      'input[type="file"]'
    )
    await fileInput.setInputFiles(
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
    await expect(
      upload.locator('tbody tr')
    ).toHaveCount(0)
  }
)

test(
  'A13: reject oversized file',
  async ({ page, url }) => {
    const widgetId = await seed()
    await page.goto(
      `${url}/admin/assets/${widgetId}`
    )
    await expect(
      page.locator('.dito-upload').first()
    ).toBeVisible({ timeout: 15_000 })

    // Upload to the filesSmall component
    // (maxSize: 100b) — tiny.jpg (285b) exceeds this
    const upload = page.locator(
      '.dito-upload:has(input#filesSmall)'
    )
    const fileInput = upload.locator(
      'input[type="file"]'
    )
    await fileInput.setInputFiles(
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
