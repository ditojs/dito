import path from 'node:path'
import { PassThrough, Readable } from 'node:stream'
import {
  AssetFile,
  Storage,
  type AssetFileObject,
  type StorageOptions,
  type UploadInfo
} from '../src/index.ts'

// A storage that keeps files in memory, to test the shared `Storage` logic.
class MemoryStorage extends Storage {
  dataByKey = new Map<string, Buffer>()
  uploads: { key: string; info: UploadInfo }[] = []

  protected override _getFileUrl(file: AssetFileObject) {
    return this._getUrl(file.key)
  }

  protected override async _upload(
    key: string,
    stream: Readable,
    info: UploadInfo
  ) {
    this.uploads.push({ key, info })
    return super._upload(key, stream, info)
  }

  protected async _addFile(file: AssetFileObject, data: Buffer) {
    this.dataByKey.set(file.key, data)
  }

  protected async _removeFile(file: AssetFileObject) {
    this.dataByKey.delete(file.key)
  }

  protected async _readFile(file: AssetFileObject) {
    return this.dataByKey.get(file.key)!
  }

  protected async _listKeys() {
    return [...this.dataByKey.keys()]
  }
}

function createStorage(options: Partial<StorageOptions> = {}) {
  return new MemoryStorage({
    name: 'memory',
    secret: 'test-secret',
    ...options
  })
}

function createImportStorage() {
  return createStorage({ allowedImports: ['https://example.com/**'] })
}

function simulateUpload(storage: Storage, key: string, name: string) {
  const file: AssetFileObject = { key, name, type: 'image/png', size: 2048 }
  storage.signAssetFile(file)
  return file
}

// Creates the start of a PNG file, enough to read its dimensions.
function createPngHeader(width: number, height: number) {
  const buffer = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12)
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  buffer[24] = 8
  buffer[25] = 6
  return buffer
}

function createUpload(chunks: Buffer[], type = 'image/png') {
  return { name: 'cover.png', type, stream: Readable.from(chunks) }
}

describe('Storage: asset key signature verification', () => {
  it('preserves the key through a full upload-then-save cycle', () => {
    const storage = createStorage()
    const uploaded = simulateUpload(storage, 'real-key.png', 'photo.png')
    const fromClient = { ...uploaded }
    storage.convertAssetFile(fromClient, { trusted: false })
    expect(fromClient.key).toBe('real-key.png')
  })

  it('throws when a forged key is submitted', () => {
    const storage = createStorage()
    const file = { key: 'victim-key.png', name: 'photo.png' }
    expect(() => {
      storage.convertAssetFile(file, { trusted: false })
    }).toThrow('Invalid asset signature')
  })

  it('throws asset errors with status 400', () => {
    const storage = createStorage()
    try {
      storage.convertAssetFile({ key: 'a.png' })
      expect.unreachable()
    } catch (error: any) {
      expect(error.name).toBe('AssetError')
      expect(error.status).toBe(400)
    }
  })

  it('accepts unsigned files from allowed import sources', () => {
    const storage = createImportStorage()
    for (const key of ['5f3e8a2c-1b4d-4c6e-9f0a-7d2b3c4e5f6a.png', 'cover']) {
      const file = { key, name: 'cover.png', url: 'https://example.com/a.png' }
      storage.convertAssetFile(file, { trusted: false })
      expect(file.key).toBe(key)
    }
  })

  it('rejects unsigned imported files with keys of other formats', () => {
    const storage = createImportStorage()
    for (const key of [
      '../escape.txt',
      '/absolute.txt',
      'nested/key.txt',
      'nested\\key.txt',
      '..',
      '.',
      '.htaccess',
      'a',
      'a.png',
      'a.b',
      'key.tar.gz',
      'key.p g',
      'key.png?x',
      'key.png#x',
      'key.png%00',
      'key.png\0',
      'http:example.org',
      '%2e%2e'
    ]) {
      const file = { key, name: 'x.txt', url: 'https://example.com/x.txt' }
      expect(() => {
        storage.convertAssetFile(file, { trusted: false })
      }).toThrow(`Invalid asset key for file 'x.txt'`)
    }
  })

  it('accepts unsigned imported files with generated keys', () => {
    const storage = createImportStorage()
    for (const name of ['photo.JPÉ', 'code.c++', 'image.jp-g', 'trailing.']) {
      const key = AssetFile.getUniqueKey(name)
      const file = { key, name, url: 'https://example.com/a.png' }
      storage.convertAssetFile(file, { trusted: false })
      expect(file.key).toBe(key)
    }
  })

  it('rejects unsigned files without string keys', () => {
    const storage = createImportStorage()
    for (const key of [undefined, null, 42, { length: 2 }] as any[]) {
      const file = { key, name: 'x.txt', url: 'https://example.com/x.txt' }
      expect(() => {
        storage.convertAssetFile(file, { trusted: false })
      }).toThrow(`Invalid asset key for file 'x.txt'`)
      const other = { key, name: 'x.txt', url: 'https://other.com/x.txt' }
      expect(() => {
        storage.convertAssetFile(other, { trusted: false })
      }).toThrow(`Invalid asset signature for file 'x.txt'`)
    }
  })

  it('accepts signed files with keys of other formats', () => {
    const storage = createImportStorage()
    const fromClient = {
      key: 'legacy/key.png',
      name: 'photo.png',
      url: 'https://example.com/a.png'
    }
    storage.signAssetFile(fromClient)
    storage.convertAssetFile(fromClient, { trusted: false })
    expect(fromClient.key).toBe('legacy/key.png')
  })

  it('throws when a valid signature is paired with a swapped key', () => {
    const storage = createStorage()
    const uploaded = simulateUpload(storage, 'legit.png', 'legit.png')
    const forged = { ...uploaded, key: 'victim-file.png' }
    expect(() => {
      storage.convertAssetFile(forged, { trusted: false })
    }).toThrow('Invalid asset signature')
  })

  it('does not throw when addFile() converts a server-created file', async () => {
    const storage = createStorage()
    const file = { key: 'imported.png', name: 'import.png' }
    await storage.addFile(file, Buffer.from('fake-image-data'))
    expect(file.key).toBe('imported.png')
  })

  it('strips signature after conversion', () => {
    const storage = createStorage()
    const uploaded = simulateUpload(storage, 'upload.png', 'photo.png')
    const fromClient = { ...uploaded }
    storage.convertAssetFile(fromClient, { trusted: false })
    expect('signature' in fromClient).toBe(false)
  })

  it('never takes file data from clients', () => {
    const storage = createStorage()
    const uploaded = simulateUpload(storage, 'upload.png', 'photo.png')
    const fromClient = { ...uploaded, data: 'injected' }
    expect(storage.convertAssetFile(fromClient).data).toBe(null)
  })
})

describe('Storage: constructor', () => {
  it('takes its settings from the options', () => {
    const storage = createStorage({
      url: 'https://cdn.example.com/files/',
      concurrency: 2,
      allowedImports: ['https://example.com/**']
    })
    expect(storage.name).toBe('memory')
    expect(storage.url).toBe('https://cdn.example.com/files/')
    expect(storage.concurrency).toBe(2)
    expect(storage.allowedImports).toEqual(['https://example.com/**'])
  })

  it('uses a default concurrency of 8', () => {
    expect(createStorage().concurrency).toBe(8)
  })

  it('keeps the secret out of its own properties', () => {
    expect(JSON.stringify(createStorage())).not.toContain('test-secret')
  })
})

describe('Storage: file operations', () => {
  it('adds files and sets their size and url', async () => {
    const storage = createStorage({ url: 'https://cdn.example.com/' })
    const file = AssetFile.create({ name: 'chapter.txt', data: 'Chapter' })
    const data = Buffer.from('Chapter one')
    const result = await storage.addFile(file, data)
    expect(result).toBe(file)
    expect(file.size).toBe(11)
    expect(file.url).toBe(`https://cdn.example.com/${file.key}`)
    expect(file.storage).toBe(storage)
    expect(await storage.readFile(file)).toBe(data)
    expect(await file.read()).toBe(data)
    expect(await storage.listKeys()).toEqual([file.key])
  })

  it('removes files', async () => {
    const storage = createStorage()
    const file = await storage.addFile({ key: 'a.txt' }, Buffer.from('a'))
    await storage.removeFile(file)
    expect(await storage.listKeys()).toEqual([])
  })

  it('returns no file paths or urls without path and url', () => {
    const storage = createStorage()
    expect(storage.getFilePath({ key: 'a.txt' })).toBeUndefined()
    expect(storage.getFileUrl({ key: 'a.txt' })).toBeUndefined()
  })

  it('joins file urls with the path of the base url', () => {
    const storage = createStorage({ url: 'https://cdn.example.com/f/' })
    expect(storage.getFileUrl({ key: 'a.txt' })).toBe(
      'https://cdn.example.com/f/a.txt'
    )
  })
})

describe('Storage: conversion of files', () => {
  it('accepts existing AssetFile instances without signature', () => {
    const storage = createStorage()
    const file = AssetFile.create({ name: 'a.txt', data: 'a' })
    storage.convertAssetFile(file)
    expect(file.storage).toBe(storage)
  })

  it('accepts unsigned files from allowed import sources', () => {
    const storage = createStorage({
      allowedImports: ['https://images.example.com/**', 'file://imports/*']
    })
    const remote = {
      key: 'remote.png',
      url: 'https://images.example.com/covers/remote.png'
    }
    storage.convertAssetFile(remote)
    expect(remote).toBeInstanceOf(AssetFile)
    const local = {
      key: 'local.png',
      url: `file://${path.resolve('imports/local.png')}`
    }
    storage.convertAssetFile(local)
    expect(local).toBeInstanceOf(AssetFile)
  })

  it('rejects unsigned files from other sources', () => {
    const storage = createStorage({
      allowedImports: ['https://images.example.com/**']
    })
    expect(() =>
      storage.convertAssetFile({
        key: 'a.png',
        url: 'https://evil.example.com/a.png'
      })
    ).toThrow(`Invalid asset signature for file 'a.png'`)
    expect(() =>
      storage.convertAssetFile({
        key: 'b.png',
        name: 'b.png',
        url: 'file:///etc/passwd'
      })
    ).toThrow(`Invalid asset signature for file 'b.png'`)
  })

  it('accepts trusted files without signature', () => {
    const storage = createStorage()
    const file = { key: 'a.png', signature: 'whatever' }
    storage.convertAssetFile(file, { trusted: true })
    expect(file).toBeInstanceOf(AssetFile)
    expect('signature' in file).toBe(false)
  })

  it('isImportSourceAllowed() rejects everything without option', () => {
    const storage = createStorage()
    expect(storage.isImportSourceAllowed('https://example.com/a.png')).toBe(
      false
    )
    expect(storage.isImportSourceAllowed(undefined)).toBe(false)
  })

  it('isImportSourceAllowed() rejects missing urls with option', () => {
    const storage = createStorage({
      allowedImports: ['https://images.example.com/**']
    })
    expect(storage.isImportSourceAllowed(undefined)).toBe(false)
  })

  it('accepts signed files without url when imports are allowed', () => {
    const storage = createStorage({
      allowedImports: ['https://images.example.com/**']
    })
    const file = { key: 'signed.png', name: 'signed.png' }
    storage.signAssetFile(file)
    storage.convertAssetFile(file)
    expect(file).toBeInstanceOf(AssetFile)
  })
})

describe('Storage: signatures', () => {
  it('signs files so that they can be verified', () => {
    const storage = createStorage()
    const file: AssetFileObject = { key: 'a.png' }
    storage.signAssetFile(file)
    expect(file.signature).toMatch(/^[0-9a-f]{64}$/)
    expect(storage.verifyAssetFile(file)).toBe(true)
  })

  it('accepts signed files sent back unchanged', async () => {
    const storage = createStorage({ url: 'https://cdn.example.com/' })
    const uploaded = await storage.upload(
      createUpload([createPngHeader(320, 200)]),
      { readDimensions: true }
    )
    const fromClient = JSON.parse(JSON.stringify(uploaded))
    storage.convertAssetFile(fromClient)
    expect(fromClient).toBeInstanceOf(AssetFile)
  })

  it('rejects signed files with changed metadata', async () => {
    const storage = createStorage({ url: 'https://cdn.example.com/' })
    const uploaded = await storage.upload(
      createUpload([createPngHeader(320, 200)]),
      { readDimensions: true }
    )
    for (const [key, value] of Object.entries({
      url: 'javascript:alert(1)',
      name: 'invoice.pdf',
      type: 'text/html',
      size: 101,
      width: 321,
      height: 201
    })) {
      expect(() =>
        storage.convertAssetFile({ ...uploaded, [key]: value })
      ).toThrow('Invalid asset signature')
    }
  })

  it('rejects signatures created with other secrets', () => {
    const storage = createStorage()
    const other = createStorage({ secret: 'other-secret' })
    const file: AssetFileObject = { key: 'a.png' }
    other.signAssetFile(file)
    expect(storage.verifyAssetFile(file)).toBe(false)
  })

  it('rejects missing, malformed and truncated signatures', () => {
    const storage = createStorage()
    const file: AssetFileObject = { key: 'a.png' }
    expect(storage.verifyAssetFile(null)).toBe(false)
    expect(storage.verifyAssetFile(file)).toBe(false)
    expect(storage.verifyAssetFile({ ...file, signature: 'xyz' })).toBe(false)
    storage.signAssetFile(file)
    expect(
      storage.verifyAssetFile({ ...file, signature: file.signature!.slice(2) })
    ).toBe(false)
  })

  it('throws when signing without secret', () => {
    const storage = createStorage({ secret: undefined })
    expect(() => storage.signAssetFile({ key: 'a.png' })).toThrow(
      `Unable to sign asset files of storage 'memory' without secret`
    )
  })
})

describe('Storage: uploads', () => {
  it('stores uploads under unique keys and returns signed files', async () => {
    const storage = createStorage({ url: 'https://cdn.example.com/' })
    const file = await storage.upload({
      name: 'Notes.TXT',
      type: 'text/plain',
      stream: Readable.from([Buffer.from('Chapter'), Buffer.from(' one')])
    })
    expect(file).toEqual({
      key: expect.stringMatching(/^[0-9a-f-]{36}\.txt$/),
      name: 'Notes.TXT',
      type: 'text/plain',
      size: 11,
      url: `https://cdn.example.com/${file.key}`,
      width: undefined,
      height: undefined,
      signature: expect.stringMatching(/^[0-9a-f]{64}$/)
    })
    expect(storage.verifyAssetFile(file)).toBe(true)
    expect(storage.dataByKey.get(file.key)!.toString()).toBe('Chapter one')
  })

  it('falls back to application/octet-stream without type', async () => {
    const storage = createStorage()
    const file = await storage.upload({
      name: 'blob',
      stream: Readable.from([Buffer.from('?')])
    })
    expect(file.type).toBe('application/octet-stream')
  })

  it('passes upload errors on', async () => {
    const storage = createStorage()
    const stream = new Readable({
      read() {
        this.destroy(new Error('Connection lost'))
      }
    })
    await expect(storage.upload({ name: 'a.txt', stream })).rejects.toThrow(
      'Connection lost'
    )
  })

  it('reads the dimensions of images with `readDimensions`', async () => {
    const storage = createStorage()
    const header = createPngHeader(320, 200)
    const rest = Buffer.from('rest of the image')
    // Split the header so the dimensions are only known after two chunks:
    const file = await storage.upload(
      createUpload([header.subarray(0, 10), header.subarray(10), rest]),
      { readDimensions: true }
    )
    expect(file.width).toBe(320)
    expect(file.height).toBe(200)
    expect(storage.uploads[0].info).toEqual({
      type: 'image/png',
      width: 320,
      height: 200
    })
    // All data still reaches the storage:
    expect(storage.dataByKey.get(file.key)).toEqual(
      Buffer.concat([header, rest])
    )
  })

  it('stores media files without readable dimensions', async () => {
    const storage = createStorage()
    const file = await storage.upload(
      createUpload([Buffer.from('not an image')], 'video/mp4'),
      { readDimensions: true }
    )
    expect(file.width).toBeUndefined()
    expect(storage.dataByKey.get(file.key)!.toString()).toBe('not an image')
  })

  it('handles empty media uploads with `readDimensions`', async () => {
    const storage = createStorage()
    const stream = new PassThrough()
    const promise = storage.upload(
      { name: 'empty.png', type: 'image/png', stream },
      { readDimensions: true }
    )
    // Emit `end` directly, so a thrown error surfaces here and not as an
    // uncaught exception.
    expect(() => stream.emit('end')).not.toThrow()
    const file = await promise
    expect(file.size).toBe(0)
  })

  it('does not read dimensions of other file types', async () => {
    const storage = createStorage()
    const file = await storage.upload(
      createUpload([createPngHeader(10, 10)], 'application/pdf'),
      { readDimensions: true }
    )
    expect(file.width).toBeUndefined()
  })

  it('does not read dimensions without `readDimensions`', async () => {
    const storage = createStorage()
    const file = await storage.upload(createUpload([createPngHeader(10, 10)]))
    expect(file.width).toBeUndefined()
  })
})
