import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Hono } from 'hono'
import { DiskStorage, S3Storage } from '../src/index.ts'
import { serveStorage } from '../src/node.ts'

describe('serveStorage()', () => {
  let basePath: string
  let storage: DiskStorage

  beforeAll(async () => {
    basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-serve-storage-'))
    storage = new DiskStorage({
      name: 'files',
      path: path.join(basePath, 'files'),
      url: 'https://example.com/files/'
    })
    await fs.writeFile(path.join(basePath, 'secret.txt'), 'Secret')
  })

  afterAll(() => fs.rm(basePath, { recursive: true }))

  function request(url: string) {
    const app = new Hono()
    app.use('/files/*', serveStorage(storage))
    return app.fetch(new Request(`http://localhost${url}`))
  }

  it('serves the files of the storage at the route', async () => {
    const file = await storage.store({
      name: 'note.txt',
      data: Buffer.from('Note')
    })
    const response = await request(new URL(file.url!).pathname)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^text\/plain/)
    expect(await response.text()).toBe('Note')
  })

  it('refuses storages that are no disk storages', () => {
    const covers = new S3Storage({
      name: 'covers',
      s3: {
        endpoint: 'https://s3.example.com',
        region: 'eu',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' }
      },
      bucket: 'covers'
    })
    expect(() => serveStorage(covers)).toThrow(
      `Unable to serve 'covers': not a disk storage.`
    )
  })

  it('answers missing files and files outside the folder with 404', async () => {
    expect((await request('/files/missing.txt')).status).toBe(404)
    expect((await request('/files/%2e%2e/secret.txt')).status).toBe(404)
    expect((await request('/secret.txt')).status).toBe(404)
  })
})
