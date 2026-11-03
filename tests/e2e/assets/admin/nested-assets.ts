import {
  test,
  expect,
  uploadViaApi,
  db
} from '../fixtures.js'
import { trackApiErrors } from '../../../utils/admin.js'
import { NestedAssetWidget } from '../models/NestedAssetWidget.js'

test.describe('nested wildcard asset paths', () => {
  test('edit route loads pre-seeded nested assets without API errors', async ({
    page,
    url
  }) => {
    const file1 = await uploadViaApi(url)
    const file2 = await uploadViaApi(url)
    const widget = await db.insert(NestedAssetWidget, {
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
    const widgetId = widget.id
    const apiErrors = trackApiErrors(page)

    // Request the API through the page, so the test doesn't depend on the
    // rendering of the form.
    const response = await page.request.get(
      `${url}/api/nested-asset-widgets/${widgetId}`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const images = body.sections.map(
      (s: any) => s.items[0].items[0].image
    )
    expect(images[0].key).toBe(file1.key)
    expect(images[1].key).toBe(file2.key)

    apiErrors.expectNone()
  })
})
