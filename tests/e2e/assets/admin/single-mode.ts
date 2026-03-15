import path from 'path'
import {
  test, expect, createModelHelpers,
  fixturesDir
} from '../fixtures.js'
import { AssetWidget } from '../models/AssetWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  AssetWidget, 'asset-widgets'
)

test(
  'A18: per-row upload button replaces file',
  async ({ page, url }) => {
    const widgetId = await seed()
    await page.goto(
      `${url}/admin/assets/${widgetId}`
    )
    await expect(
      page.locator('.dito-upload').first()
    ).toBeVisible({ timeout: 15_000 })

    // Find the single-file upload component
    const container = page.locator(
      '.dito-upload:has(input#file)'
    )

    // Upload initial file
    const responsePromise1 =
      page.waitForResponse(
        resp =>
          resp.url().includes('/upload/') &&
          resp.ok()
      )
    await container.locator(
      'input[type="file"]'
    ).setInputFiles(
      path.resolve(fixturesDir, 'tiny.png')
    )
    await responsePromise1

    // Verify file row
    await expect(
      container.locator('tbody tr')
    ).toHaveCount(1)
    await expect(
      container.locator('tbody tr')
    ).toContainText('tiny.png')

    // Per-row upload button should exist
    const rowUploadBtn = container.locator(
      'tbody .dito-button--upload'
    )
    await expect(rowUploadBtn).toBeVisible()

    // Use per-row button to replace
    const responsePromise2 =
      page.waitForResponse(
        resp =>
          resp.url().includes('/upload/') &&
          resp.ok()
      )
    await container.locator(
      'input[type="file"]'
    ).setInputFiles(
      path.resolve(fixturesDir, 'tiny.jpg')
    )
    await responsePromise2

    // Should still have exactly 1 row
    await expect(
      container.locator('tbody tr')
    ).toHaveCount(1)
    await expect(
      container.locator('tbody tr')
    ).toContainText('tiny.jpg')
  }
)

test(
  'A19: footer upload hidden when file exists',
  async ({ page, url }) => {
    const widgetId = await seed()
    await page.goto(
      `${url}/admin/assets/${widgetId}`
    )
    await expect(
      page.locator('.dito-upload').first()
    ).toBeVisible({ timeout: 15_000 })

    const container = page.locator(
      '.dito-upload:has(input#file)'
    )

    // No file: footer upload button visible
    await expect(
      container.locator(
        'tfoot .dito-button--upload'
      )
    ).toBeVisible()

    // Upload a file
    const responsePromise =
      page.waitForResponse(
        resp =>
          resp.url().includes('/upload/') &&
          resp.ok()
      )
    await container.locator(
      'input[type="file"]'
    ).setInputFiles(
      path.resolve(fixturesDir, 'tiny.png')
    )
    await responsePromise

    // Footer upload button should be hidden
    await expect(
      container.locator(
        'tfoot .dito-button--upload'
      )
    ).not.toBeVisible()
  }
)
