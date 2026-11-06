import { Readable } from 'node:stream'
import { Hono } from 'hono'
import { createApi, defineController, sendFile } from './index.ts'

describe('sendFile()', () => {
  const files = defineController({
    path: 'files',
    actions: {
      'get csv': ({ c }) => sendFile(c, 'a,b', { filename: 'export.csv' }),
      'get pdf': ({ c }) => {
        c.header('Cache-Control', 'no-store')
        return sendFile(c, new Uint8Array([1, 2]), {
          filename: 'Ünï "1".pdf',
          type: 'application/x-pdf',
          inline: true
        })
      },
      'get quotes': ({ c }) =>
        sendFile(c, 'data', { filename: `Font's (Bold)*.otf` }),
      'get unknown': ({ c }) =>
        sendFile(c, 'data', { filename: 'data.unknown' }),
      'get image': ({ c }) =>
        sendFile(c, 'data', { type: 'image/png', inline: true }),
      'get stream': ({ c }) =>
        sendFile(c, Readable.from([Buffer.from('a,'), Buffer.from('b')]), {
          filename: 'export.csv'
        })
    }
  })
  const app = new Hono().route('/api', createApi({ controllers: [files] }))

  it('answers as an attachment with the type of the file name', async () => {
    const response = await app.request('/api/files/csv')
    expect(await response.text()).toBe('a,b')
    expect(response.headers.get('Content-Type')).toBe(
      'text/csv; charset=utf-8'
    )
    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="export.csv"; filename*=UTF-8''export.csv`
    )
  })

  it('answers inline with a type, and encodes the name', async () => {
    const response = await app.request('/api/files/pdf')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2])
    )
    expect(response.headers.get('Content-Type')).toBe('application/x-pdf')
    expect(response.headers.get('Content-Disposition')).toBe(
      `inline; filename="_n_ _1_.pdf"; ` +
      `filename*=UTF-8''%C3%9Cn%C3%AF%20%221%22.pdf`
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it(`escapes the quotes and parentheses of \`filename*\``, async () => {
    const response = await app.request('/api/files/quotes')
    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="Font's (Bold)*.otf"; ` +
      `filename*=UTF-8''Font%27s%20%28Bold%29%2A.otf`
    )
  })

  it('falls back to binary data for unknown types', async () => {
    const response = await app.request('/api/files/unknown')
    expect(response.headers.get('Content-Type')).toBe(
      'application/octet-stream'
    )
  })

  it('answers without a file name', async () => {
    const response = await app.request('/api/files/image')
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Content-Disposition')).toBe('inline')
  })

  it('answers with a stream of Node', async () => {
    const response = await app.request('/api/files/stream')
    expect(await response.text()).toBe('a,b')
  })
})
