import { test, expect, uploadViaApi } from '../fixtures.js'
import { NestedAssetWidget } from '../models/NestedAssetWidget.js'

test.describe('wildcard asset paths', () => {
  test(
    'signs files at every wildcard match in the GET response',
    async ({ url }) => {
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
      const id = widget.$id()

      const resp = await fetch(
        `${url}/api/nested-asset-widgets/${id}`
      )
      expect(resp.ok).toBe(true)
      const body = await resp.json()
      const images = body.sections.map(
        (s: any) => s.items[0].items[0].image
      )
      expect(images[0].key).toBe(file1.key)
      expect(images[1].key).toBe(file2.key)
      expect(images[0].signature).toMatch(/^[0-9a-f]+$/)
      expect(images[1].signature).toMatch(/^[0-9a-f]+$/)
    }
  )

  test(
    'round-trips signed files through PATCH unchanged',
    async ({ url }) => {
      const file = await uploadViaApi(url)
      const widget = await NestedAssetWidget.query()
        .insert({
          sections: [
            {
              items: [
                { items: [{ image: file }] }
              ]
            }
          ]
        })
      const id = widget.$id()

      // Fetch the signed body, then patch it back as-is.
      // Without the wildcard fix the GET response would
      // be missing `signature` and the PATCH would fail
      // verification with 400.
      const getResp = await fetch(
        `${url}/api/nested-asset-widgets/${id}`
      )
      const body = await getResp.json()

      const patchResp = await fetch(
        `${url}/api/nested-asset-widgets/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      )
      expect(patchResp.ok).toBe(true)
    }
  )
})
