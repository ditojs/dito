import path from 'path'
import {
  test, expect, createModelHelpers,
  uploadFile, fixturesDir
} from '../fixtures.js'
import { AssetWidget } from '../models/AssetWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  AssetWidget, 'asset-widgets'
)

test(
  'A7: delete file via confirm dialog',
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
    await expect(
      upload.locator('tbody tr')
    ).toHaveCount(1)

    // Accept the confirm dialog
    page.on('dialog', dialog => dialog.accept())
    await upload.locator(
      '.dito-button--delete'
    ).first().click()

    await expect(
      upload.locator('tbody tr')
    ).toHaveCount(0)
  }
)

test(
  'A8: cancel delete keeps file',
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

    // Dismiss the confirm dialog
    page.once('dialog', dialog =>
      dialog.dismiss()
    )
    await upload.locator(
      '.dito-button--delete'
    ).first().click()

    // File should still be there
    await expect(
      upload.locator('tbody tr')
    ).toHaveCount(1)
  }
)

test(
  'A9: delete persists on save',
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

    // Upload and save first
    await uploadFile(
      page,
      path.resolve(fixturesDir, 'tiny.png')
    )
    await saveAndFetch(page, widgetId)

    // Reload and delete
    await page.goto(
      `${url}/admin/assets/${widgetId}`
    )
    await expect(
      upload.locator('tbody tr')
    ).toHaveCount(1)

    page.on('dialog', dialog => dialog.accept())
    await upload.locator(
      '.dito-button--delete'
    ).first().click()

    await expect(
      upload.locator('tbody tr')
    ).toHaveCount(0)

    const widget = await saveAndFetch(
      page, widgetId
    )
    const files = widget.files as any[]
    expect(files).toHaveLength(0)
  }
)

test(
  'A10: delete shows notification',
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

    page.on('dialog', dialog => dialog.accept())
    await upload.locator(
      '.dito-button--delete'
    ).first().click()

    // Check notification
    const notification = page.locator(
      '.dito-notification'
    )
    await expect(notification).toContainText(
      'Successfully Removed'
    )
    await expect(notification).toContainText(
      'tiny.png was deleted.'
    )
  }
)

test(
  'A11: replace file (delete + upload new)',
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

    // Upload first file and save
    await uploadFile(
      page,
      path.resolve(fixturesDir, 'tiny.png')
    )
    const widget1 = await saveAndFetch(
      page, widgetId
    )
    const firstFile = (widget1.files as any[])[0]

    // Reload, delete, upload replacement
    await page.goto(
      `${url}/admin/assets/${widgetId}`
    )
    await expect(
      upload.locator('tbody tr')
    ).toHaveCount(1)

    page.on('dialog', dialog => dialog.accept())
    await upload.locator(
      '.dito-button--delete'
    ).first().click()

    await expect(
      upload.locator('tbody tr')
    ).toHaveCount(0)

    await uploadFile(
      page,
      path.resolve(fixturesDir, 'small.png')
    )

    const widget2 = await saveAndFetch(
      page, widgetId
    )
    const files = widget2.files as any[]
    expect(files).toHaveLength(1)
    expect(files[0].key).not.toBe(firstFile.key)
    expect(files[0].name).toBe('small.png')
    expect(files[0].size).not.toBe(firstFile.size)
  }
)
