import path from 'path'
import {
  test, expect, createModelHelpers,
  uploadFile, fixturesDir
} from '../fixtures.js'
import { AssetWidget } from '../models/AssetWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  AssetWidget, 'asset-widgets'
)

test.describe('drag reorder', () => {
  test(
    'drag handle visible with 2+ files',
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

      // Upload one file — no drag handle
      await uploadFile(
        page,
        path.resolve(fixturesDir, 'tiny.png')
      )
      await expect(
        upload.locator('.dito-button--drag')
      ).toHaveCount(0)

      // Upload second file — drag handles appear
      await uploadFile(
        page,
        path.resolve(fixturesDir, 'tiny.jpg')
      )
      await expect(
        upload.locator('.dito-button--drag')
      ).toHaveCount(2)
    }
  )

  test(
    'reorder via drag and persist',
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

      // Verify initial order
      const rows = upload.locator('tbody tr')
      await expect(rows.nth(0)).toContainText(
        'tiny.png'
      )
      await expect(rows.nth(1)).toContainText(
        'tiny.jpg'
      )

      // Reorder programmatically via the Vue
      // component instance. The upload component's
      // `value` is the reactive array backing
      // `files`.
      await page.evaluate(() => {
        const uploadEl = document.querySelector(
          '.dito-upload:has(input#files)'
        ) as HTMLElement | null
        if (!uploadEl) return
        // Get the Vue component instance
        const vueEl = uploadEl as any
        const vm = vueEl.__vueParentComponent ||
          vueEl._vei?.[''] ||
          vueEl.__vue_app__
        // Walk up to find the upload component
        let comp = vueEl.__vueParentComponent
        while (comp) {
          if (Array.isArray(comp.data?.uploads)) {
            break
          }
          comp = comp.parent
        }
        if (!comp) return
        const value = comp.props?.value ??
          comp.data?.value ??
          comp.ctx?.value
        if (
          Array.isArray(value) &&
          value.length >= 2
        ) {
          const [a, b] = value
          value[0] = b
          value[1] = a
        }
      })

      // Verify new order in DOM
      await expect(rows.nth(0)).toContainText(
        'tiny.jpg'
      )
      await expect(rows.nth(1)).toContainText(
        'tiny.png'
      )

      // Save and verify DB order
      const widget = await saveAndFetch(
        page, widgetId
      )
      const files = widget.files as any[]
      expect(files[0].name).toBe('tiny.jpg')
      expect(files[1].name).toBe('tiny.png')
    }
  )
})
