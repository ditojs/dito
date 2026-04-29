import {
  test, expect, uploadViaApi
} from '../fixtures.js'
import { trackApiErrors } from '../../../utils/admin.js'
import { NestedAssetWidget } from '../models/NestedAssetWidget.js'

test.describe('nested wildcard asset paths', () => {
  test(
    'edit route loads pre-seeded nested assets without API errors',
    async ({ page, url }) => {
      const file1 = await uploadViaApi(url)
      const file2 = await uploadViaApi(url)
      const widget = await NestedAssetWidget.query()
        .insert({
          sections: [
            {
              items: [
                { items: [{ image: file1 }] }
              ]
            },
            {
              items: [
                { items: [{ image: file2 }] }
              ]
            }
          ]
        })
      const widgetId = widget.$id()
      const apiErrors = trackApiErrors(page)

      // Hit the API directly via the page context so the test
      // verifies the round-trip through the admin's API surface
      // without depending on the form schema rendering.
      const response = await page.request.get(
        `${url}/api/nested-asset-widgets/${widgetId}`
      )
      expect(response.ok()).toBe(true)

      // Without the wildcard fix, the GET response would be missing
      // `signature` on every asset, preventing later round-trip saves.
      const body = await response.json()
      const images = body.sections.map(
        (s: any) => s.items[0].items[0].image
      )
      expect(images[0].signature).toMatch(/^[0-9a-f]+$/)
      expect(images[1].signature).toMatch(/^[0-9a-f]+$/)

      apiErrors.expectNone()
    }
  )
})
