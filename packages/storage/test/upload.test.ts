import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Hono } from 'hono'
import {
  AssetFile,
  DiskStorage,
  uploadHandler,
  type AssetFileObject,
  type UploadHandlerOptions
} from '../src/index.ts'

let basePath: string
let storage: DiskStorage

beforeEach(async () => {
  basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-upload-'))
  storage = new DiskStorage({
    name: 'covers',
    secret: 'secret',
    path: basePath,
    url: 'https://library.example.com/covers/'
  })
})

afterEach(async () => {
  await fs.rm(basePath, { recursive: true, force: true })
})

function createApp(options?: UploadHandlerOptions) {
  const app = new Hono()
  app.post('/books/upload/:path{.+}', uploadHandler(storage, options))
  return app
}

// Sends the files like the admin's upload component, under the data path of
// their field.
function upload(
  app: Hono,
  files: Record<string, File | File[]>,
  url = '/books/upload/cover'
) {
  const body = new FormData()
  for (const [field, value] of Object.entries(files)) {
    for (const file of [value].flat()) body.append(field, file)
  }
  return app.request(url, { method: 'POST', body })
}

function createPngHeader(width: number, height: number) {
  const buffer = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12)
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

async function listFiles() {
  return (await fs.readdir(basePath, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
}

describe('uploadHandler()', () => {
  it('stores files and answers with their signed file objects', async () => {
    const app = createApp()
    const res = await upload(app, {
      cover: new File(['Front'], 'Front Cover.TXT', { type: 'text/plain' })
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/^application\/json/)
    const files: AssetFileObject[] = await res.json()
    expect(files).toEqual([
      {
        key: expect.stringMatching(/^[0-9a-f-]{36}\.txt$/),
        name: 'Front Cover.TXT',
        type: 'text/plain',
        size: 5,
        url: expect.stringMatching(
          /^https:\/\/library\.example\.com\/covers\/.\/.\/.+\.txt$/
        ),
        signature: expect.stringMatching(/^[0-9a-f]{64}$/)
      }
    ])
    const [file] = files
    expect(await fs.readFile(storage.getFilePath(file)!, 'utf8')).toBe('Front')
    // The admin sends the file object back when it saves the form:
    expect(storage.convertAssetFile(file)).toBeInstanceOf(AssetFile)
  })

  it('stores several files of one request', async () => {
    const app = createApp()
    const res = await upload(app, {
      covers: [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]
    })
    const files: AssetFileObject[] = await res.json()
    expect(files.map(file => file.name)).toEqual(['a.txt', 'b.txt'])
    expect((await listFiles()).sort()).toEqual(
      files.map(file => file.key).sort()
    )
  })

  it('falls back to application/octet-stream without type', async () => {
    const app = createApp()
    const res = await upload(app, {
      cover: new File([createPngHeader(1, 1)], 'cover.png', { type: '' })
    })
    const [file] = await res.json()
    expect(file.type).toBe('application/octet-stream')
  })

  it('only takes files of fields that match the data path', async () => {
    const app = createApp({ dataPath: 'chapters/*/images/**' })
    const res = await upload(app, {
      'chapters/3/images/0/file': new File(['a'], 'a.txt'),
      'chapters/create/images/1': new File(['b'], 'b.txt'),
      'chapters/3/cover': new File(['c'], 'c.txt'),
      'chapters/images/0': new File(['d'], 'd.txt')
    })
    const files: AssetFileObject[] = await res.json()
    expect(files.map(file => file.name)).toEqual(['a.txt', 'b.txt'])
    expect(await listFiles()).toHaveLength(2)
  })

  it('matches data path tokens literally', async () => {
    const app = createApp({ dataPath: 'cover.image' })
    const res = await upload(app, {
      'cover/image': new File(['a'], 'a.txt'),
      'coverXimage': new File(['b'], 'b.txt')
    })
    const files: AssetFileObject[] = await res.json()
    expect(files.map(file => file.name)).toEqual(['a.txt'])
  })

  it('answers with an empty array without matching files', async () => {
    const app = createApp({ dataPath: 'cover' })
    const res = await upload(app, { other: new File(['a'], 'a.txt') })
    expect(await res.json()).toEqual([])
  })

  it('reads image dimensions with `readDimensions`', async () => {
    const app = createApp({ readDimensions: true })
    const res = await upload(app, {
      cover: new File([createPngHeader(320, 200)], 'cover.png', {
        type: 'image/png'
      })
    })
    const [file] = await res.json()
    expect(file).toMatchObject({ width: 320, height: 200, size: 33 })
    expect(storage.verifyAssetFile(file)).toBe(true)
  })

  it('answers files above `limits.fileSize` with 413', async () => {
    const app = createApp({ limits: { fileSize: 4 } })
    const res = await upload(app, { cover: new File(['Front'], 'a.txt') })
    expect(res.status).toBe(413)
    expect(await listFiles()).toEqual([])
  })

  it('answers more files than `limits.files` with 400', async () => {
    const app = createApp({ limits: { files: 1 } })
    const res = await upload(app, {
      covers: [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]
    })
    expect(res.status).toBe(400)
    expect(await listFiles()).toEqual([])
  })

  it('answers bodies that are not multipart with 415', async () => {
    const app = createApp()
    const res = await app.request('/books/upload/cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
    expect(res.status).toBe(415)
  })

  it('passes the stored files to `onUpload` before sending them', async () => {
    const calls: { path?: string; files: AssetFileObject[] }[] = []
    const app = createApp({
      onUpload: (c, files) => {
        calls.push({ path: c.req.param('path'), files })
      }
    })
    const res = await upload(app, { cover: new File(['a'], 'a.txt') })
    expect(await res.json()).toEqual(calls[0].files)
    expect(calls[0].path).toBe('cover')
  })

  it('removes the stored files when `onUpload` throws', async () => {
    const app = createApp({
      onUpload: () => {
        throw new Error('Database down')
      }
    })
    app.onError((error, c) => c.text(error.message, 500))
    const res = await upload(app, {
      covers: [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]
    })
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('Database down')
    expect(await listFiles()).toEqual([])
  })
})
