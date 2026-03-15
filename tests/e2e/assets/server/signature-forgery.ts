import {
  test, expect, uploadViaApi, suppressErrors
} from '../fixtures.js'
import { AssetWidget } from '../models/AssetWidget.js'

test(
  'B15: reject patch with missing signature',
  async ({ url }) => {
    const fileObj = await uploadViaApi(url)
    const app = AssetWidget.app!

    // Insert a widget with a valid file
    const widget = await AssetWidget.query()
      .insert({ files: [fileObj] })
    const id = widget.$id()

    // Patch via API with the signature stripped
    const { signature: _, ...unsigned } = fileObj
    const resp = await suppressErrors(
      app,
      () => fetch(
        `${url}/api/asset-widgets/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: [unsigned]
          })
        }
      )
    )

    expect(resp.ok).toBe(false)
    const body = await resp.json()
    expect(body.message).toMatch(
      /Invalid asset signature/
    )
  }
)

test(
  'B16: reject patch with forged key',
  async ({ url }) => {
    const fileObj = await uploadViaApi(url)
    const app = AssetWidget.app!

    const widget = await AssetWidget.query()
      .insert({ files: [fileObj] })
    const id = widget.$id()

    // Use the valid signature but swap the key
    const forged = {
      ...fileObj,
      key: 'stolen-file.png'
    }
    const resp = await suppressErrors(
      app,
      () => fetch(
        `${url}/api/asset-widgets/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: [forged]
          })
        }
      )
    )

    expect(resp.ok).toBe(false)
    const body = await resp.json()
    expect(body.message).toMatch(
      /Invalid asset signature/
    )
  }
)

test(
  'B17: reject patch with tampered signature',
  async ({ url }) => {
    const fileObj = await uploadViaApi(url)
    const app = AssetWidget.app!

    const widget = await AssetWidget.query()
      .insert({ files: [fileObj] })
    const id = widget.$id()

    // Re-fetch to get a signed file object
    const fetched = await AssetWidget.query()
      .findById(id)
    const signedFile = fetched!.$toJson().files[0]

    // Flip a character in the signature
    const tampered = {
      ...signedFile,
      signature: signedFile.signature.replace(
        /^./, (c: string) =>
          c === 'a' ? 'b' : 'a'
      )
    }
    const resp = await suppressErrors(
      app,
      () => fetch(
        `${url}/api/asset-widgets/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: [tampered]
          })
        }
      )
    )

    expect(resp.ok).toBe(false)
    const body = await resp.json()
    expect(body.message).toMatch(
      /Invalid asset signature/
    )
  }
)

test(
  'B18: reject insert with fabricated file',
  async ({ url }) => {
    const app = AssetWidget.app!

    // Try to insert a completely fabricated file
    // (not uploaded, no valid signature)
    const resp = await suppressErrors(
      app,
      () => fetch(
        `${url}/api/asset-widgets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: [{
              key: 'fabricated.png',
              name: 'evil.png',
              type: 'image/png',
              size: 1024,
              url: '/uploads/fabricated.png',
              signature: '0'.repeat(64)
            }]
          })
        }
      )
    )

    expect(resp.ok).toBe(false)
    const body = await resp.json()
    expect(body.message).toMatch(
      /Invalid asset signature/
    )
  }
)

test(
  'B19: valid signature accepted on patch',
  async ({ url }) => {
    const fileObj = await uploadViaApi(url)

    const widget = await AssetWidget.query()
      .insert({ files: [fileObj] })
    const id = widget.$id()

    // Re-fetch to get signed file from $formatJson
    const fetched = await AssetWidget.query()
      .findById(id)
    const signedFiles = fetched!.$toJson().files

    // Patch with the properly signed file —
    // should succeed
    const resp = await fetch(
      `${url}/api/asset-widgets/${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: signedFiles
        })
      }
    )

    expect(resp.ok).toBe(true)
  }
)
