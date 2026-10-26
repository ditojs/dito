import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { Page } from '@playwright/test'
import { test, expect, fixturesDir } from '../fixtures.js'
import { createModelHelpers } from '../../../utils/fixture-app.js'
import { DitoUploadField } from '../../../utils/pages.js'
import { AssetWidget } from '../models/AssetWidget.js'

const { seed, saveAndFetch } = createModelHelpers(AssetWidget, 'asset-widgets')

async function selectInterchangeItem(page: Page, label: string) {
  await page.locator('.dito-clipboard .dito-button--interchange').click()
  await page.getByRole('menuitem', { name: label }).click()
}

test.describe('interchange', () => {
  test('downloads a form with its files and uploads it into another item', async ({
    page,
    url
  }) => {
    // Store two files in the first widget:
    const sourceId = await seed()
    await page.goto(`${url}/admin/interchange/${sourceId}`)
    const files = new DitoUploadField(page, 'files')
    const file = new DitoUploadField(page, 'file')
    await files.waitUntilVisible()
    await files.upload(path.resolve(fixturesDir, 'tiny.png'))
    await file.upload(path.resolve(fixturesDir, 'tiny.jpg'))
    const source = await saveAndFetch(page, sourceId)

    // Download the stored widget as a zip:
    await page.goto(`${url}/admin/interchange/${sourceId}`)
    await expect(files.rows).toContainText('Stored')
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-e2e-zip-'))
    const zipPath = path.join(tmpDir, 'widget.zip')
    try {
      const downloadPromise = page.waitForEvent('download')
      await selectInterchangeItem(page, 'Download')
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe('interchange.zip')
      await download.saveAs(zipPath)

      // Upload the zip into a second widget, which stores the files again:
      const targetId = await seed()
      await page.goto(`${url}/admin/interchange/${targetId}`)
      await files.waitUntilVisible()
      let uploadCount = 0
      page.on('response', response => {
        if (response.url().includes('/upload/') && response.ok()) {
          uploadCount++
        }
      })
      await page
        .locator('.dito-clipboard input[type="file"]')
        .setInputFiles(zipPath)
      await expect(files.rows).toHaveCount(1)
      await expect(files.getRow(0)).toContainText('tiny.png')
      await expect(file.rows).toHaveCount(1)
      await expect(file.getRow(0)).toContainText('tiny.jpg')
      expect(uploadCount).toBe(2)

      const target = await saveAndFetch(page, targetId)
      const [sourceFile] = source.files
      const [targetFile] = target.files
      expect(targetFile).toMatchObject({
        name: sourceFile.name,
        type: sourceFile.type,
        size: sourceFile.size
      })
      expect(target.file).toMatchObject({
        name: source.file!.name,
        type: source.file!.type,
        size: source.file!.size
      })
      expect(targetFile.key).not.toBe(sourceFile.key)
      expect(target.file!.key).not.toBe(source.file!.key)

      // The stored files hold the same bytes:
      for (const [stored, fixture] of [
        [targetFile, 'tiny.png'],
        [target.file!, 'tiny.jpg']
      ] as const) {
        const response = await fetch(stored.url)
        expect(Buffer.from(await response.arrayBuffer())).toEqual(
          await fs.readFile(path.resolve(fixturesDir, fixture))
        )
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})
