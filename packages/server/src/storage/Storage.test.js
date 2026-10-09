import { vi } from 'vitest'
import path from 'path'
import { PassThrough, Readable } from 'stream'
import { Storage } from './Storage.js'
import { AssetFile } from './AssetFile.js'

function createStorage(keys = ['test-secret']) {
  const app = { keys }
  return new Storage(app, { name: 'test' })
}

function simulateUpload(storage, key, originalname) {
  return storage.convertStorageFile({
    key,
    originalname,
    mimetype: 'image/png',
    size: 2048
  })
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
    const data = Buffer.from('fake-image-data')
    await storage.addFile(file, data)
    expect(file.key).toBe('imported.png')
  })

  it('strips signature after conversion', () => {
    const storage = createStorage()
    const uploaded = simulateUpload(storage, 'upload.png', 'photo.png')
    const fromClient = { ...uploaded }
    storage.convertAssetFile(fromClient, { trusted: false })
    expect('signature' in fromClient).toBe(false)
  })
})

// A storage that keeps files in memory, to test the generic `Storage` logic.
class MemoryStorage extends Storage {
  dataByKey = new Map()

  _getFilePath(file) {
    return this._getPath(file.key)
  }

  _getFileUrl(file) {
    return this._getUrl(file.key)
  }

  async _addFile(file, data) {
    this.dataByKey.set(file.key, data)
  }

  async _removeFile(file) {
    this.dataByKey.delete(file.key)
  }

  async _readFile(file) {
    return this.dataByKey.get(file.key)
  }

  async _listKeys() {
    return [...this.dataByKey.keys()]
  }
}

function createMemoryStorage(config = {}) {
  const app = { keys: ['test-secret'], basePath: '/app', emit: vi.fn() }
  return new MemoryStorage(app, { name: 'memory', ...config })
}

// Creates the start of a PNG file, enough to read its dimensions.
function createPngHeader(width, height) {
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

// A multer-like storage engine that consumes the file stream.
function createUploadEngine() {
  return {
    _handleFile(req, file, callback) {
      const chunks = []
      file.stream.on('data', chunk => chunks.push(chunk))
      file.stream.on('end', () => {
        callback(null, {
          key: `${file.originalname}-key`,
          data: Buffer.concat(chunks)
        })
      })
    },
    _removeFile(req, file, callback) {
      callback(null)
    }
  }
}

function createUpload(chunks, mimetype = 'image/png') {
  return {
    originalname: 'cover.png',
    mimetype,
    stream: Readable.from(chunks)
  }
}

describe('Storage: constructor', () => {
  it('takes its settings from the config', () => {
    const storage = createMemoryStorage({
      url: 'https://cdn.example.com/files/',
      path: 'uploads',
      concurrency: 2
    })
    expect(storage.name).toBe('memory')
    expect(storage.url).toBe('https://cdn.example.com/files/')
    expect(storage.path).toBe('uploads')
    expect(storage.concurrency).toBe(2)
    expect(storage.storage).toBe(null)
    expect(storage.initialized).toBe(false)
  })

  it('uses a default concurrency of 8', () => {
    expect(createMemoryStorage().concurrency).toBe(8)
  })
})

describe('Storage.register()', () => {
  it('derives the type from the class name', () => {
    class CloudArchiveStorage extends Storage {}
    Storage.register(CloudArchiveStorage)
    expect(CloudArchiveStorage.type).toBe('cloud-archive')
    expect(Storage.get('cloud-archive')).toBe(CloudArchiveStorage)
  })

  it('accepts class names without a `Storage` suffix', () => {
    class Shelf extends Storage {}
    Storage.register(Shelf)
    expect(Shelf.type).toBe('shelf')
  })

  it('keeps an explicitly defined type', () => {
    class BookStorage extends Storage {
      static type = 'books'
    }
    Storage.register(BookStorage)
    expect(Storage.get('books')).toBe(BookStorage)
    expect(Storage.get('book')).toBe(null)
  })

  it('returns null for unknown types', () => {
    expect(Storage.get('unknown')).toBe(null)
  })
})

describe('Storage: file operations', () => {
  it('adds files and sets their size and url', async () => {
    const storage = createMemoryStorage({ url: 'https://cdn.example.com/' })
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
    const storage = createMemoryStorage()
    const file = await storage.addFile({ key: 'a.txt' }, Buffer.from('a'))
    await storage.removeFile(file)
    expect(await storage.listKeys()).toEqual([])
  })

  it('returns file paths relative to the app base path', () => {
    const storage = createMemoryStorage({ path: 'uploads' })
    expect(storage.getFilePath({ key: 'a.txt' })).toBe(
      path.resolve('/app', 'uploads', 'a.txt')
    )
  })

  it('returns no file paths or urls without path and url', () => {
    const storage = createMemoryStorage()
    expect(storage.getFilePath({ key: 'a.txt' })).toBeUndefined()
    expect(storage.getFileUrl({ key: 'a.txt' })).toBeUndefined()
  })

  it('joins file urls with the path of the base url', () => {
    const storage = createMemoryStorage({ url: 'https://cdn.example.com/f/' })
    expect(storage.getFileUrl({ key: 'a.txt' })).toBe(
      'https://cdn.example.com/f/a.txt'
    )
  })

  it('provides no-op default implementations', async () => {
    const storage = new Storage({ keys: ['secret'] }, { name: 'base' })
    await storage.setup()
    await storage.initialize()
    const file = { key: 'a.txt' }
    expect(storage.getFilePath(file)).toBeUndefined()
    expect(storage.getFileUrl(file)).toBeUndefined()
    expect(await storage.readFile(file)).toBeUndefined()
    expect(await storage.listKeys()).toBeUndefined()
    await expect(storage.removeFile(file)).resolves.toBeUndefined()
  })
})

describe('Storage: conversion of files', () => {
  it('converts multer files to asset file data', () => {
    const storage = createMemoryStorage({ url: 'https://cdn.example.com/' })
    const [file] = storage.convertStorageFiles([
      {
        key: 'abc.png',
        originalname: 'cover.png',
        mimetype: 'image/png',
        size: 100,
        width: 320,
        height: 200
      }
    ])
    expect(file).toEqual({
      key: 'abc.png',
      name: 'cover.png',
      type: 'image/png',
      size: 100,
      url: 'https://cdn.example.com/abc.png',
      width: 320,
      height: 200,
      signature: expect.stringMatching(/^[0-9a-f]{64}$/)
    })
    expect(storage.verifyAssetFile(file)).toBe(true)
  })

  it('accepts existing AssetFile instances without signature', () => {
    const storage = createMemoryStorage()
    const file = AssetFile.create({ name: 'a.txt', data: 'a' })
    storage.convertAssetFile(file)
    expect(file.storage).toBe(storage)
  })

  it('accepts unsigned files from allowed import sources', () => {
    const storage = createMemoryStorage({
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
    const storage = createMemoryStorage({
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
    const storage = createMemoryStorage()
    const file = { key: 'a.png', signature: 'whatever' }
    storage.convertAssetFile(file, { trusted: true })
    expect(file).toBeInstanceOf(AssetFile)
    expect('signature' in file).toBe(false)
  })

  it('isImportSourceAllowed() rejects everything without config', () => {
    const storage = createMemoryStorage()
    expect(storage.isImportSourceAllowed('https://example.com/a.png')).toBe(
      false
    )
    expect(storage.isImportSourceAllowed(undefined)).toBe(false)
  })
})

describe('Storage: signatures', () => {
  it('signs files so that they can be verified', () => {
    const storage = createMemoryStorage()
    const file = { key: 'a.png' }
    storage.signAssetFile(file)
    expect(file.signature).toMatch(/^[0-9a-f]{64}$/)
    expect(storage.verifyAssetFile(file)).toBe(true)
  })

  it('rejects signatures created with other keys', () => {
    const storage = createMemoryStorage()
    const other = new Storage({ keys: ['other-secret'] }, { name: 'other' })
    const file = { key: 'a.png' }
    other.signAssetFile(file)
    expect(storage.verifyAssetFile(file)).toBe(false)
  })

  it('rejects missing, malformed and truncated signatures', () => {
    const storage = createMemoryStorage()
    const file = { key: 'a.png' }
    expect(storage.verifyAssetFile(null)).toBe(false)
    expect(storage.verifyAssetFile(file)).toBe(false)
    expect(storage.verifyAssetFile({ ...file, signature: 'xyz' })).toBe(false)
    storage.signAssetFile(file)
    expect(
      storage.verifyAssetFile({ ...file, signature: file.signature.slice(2) })
    ).toBe(false)
  })

  it('signs with a shared fallback secret when no keys exist', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      Storage._fallbackSecret = undefined
      const storage1 = new Storage({}, { name: 'one' })
      const storage2 = new Storage({}, { name: 'two' })
      const file = { key: 'a.png' }
      storage1.signAssetFile(file)
      expect(storage2.verifyAssetFile(file)).toBe(true)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][0]).toContain('No app.keys configured')
    } finally {
      Storage._fallbackSecret = undefined
      warn.mockRestore()
    }
  })
})

describe('Storage: uploads', () => {
  it('returns no upload storage and handler without a multer storage', () => {
    const storage = createMemoryStorage()
    expect(storage.getUploadStorage({})).toBe(null)
    expect(storage.getUploadHandler({})).toBe(null)
  })

  it('returns an upload handler middleware with a multer storage', () => {
    const storage = createMemoryStorage()
    storage.storage = createUploadEngine()
    expect(storage.getUploadHandler({})).toBeTypeOf('function')
  })

  it('creates upload storages that inherit from the multer storage', () => {
    const storage = createMemoryStorage()
    storage.storage = createUploadEngine()
    const uploadStorage = storage.getUploadStorage({})
    expect(Object.getPrototypeOf(uploadStorage)).toBe(storage.storage)
    expect(uploadStorage._removeFile).toBe(storage.storage._removeFile)
  })

  it('handles uploads through the multer storage', async () => {
    const storage = createMemoryStorage()
    storage.storage = createUploadEngine()
    const uploadStorage = storage.getUploadStorage({})
    const result = await new Promise((resolve, reject) => {
      uploadStorage._handleFile(
        {},
        createUpload([Buffer.from('text')], 'text/plain'),
        (err, result) => (err ? reject(err) : resolve(result))
      )
    })
    expect(result.data.toString()).toBe('text')
  })

  it('passes upload errors on to the callback', async () => {
    const storage = createMemoryStorage()
    storage.storage = {
      _handleFile(req, file, callback) {
        callback(new Error('Disk full'))
      }
    }
    const uploadStorage = storage.getUploadStorage({})
    const error = await new Promise(resolve => {
      uploadStorage._handleFile({}, createUpload([]), resolve)
    })
    expect(error.message).toBe('Disk full')
  })

  it('reads the dimensions of images with `readDimensions`', async () => {
    const storage = createMemoryStorage()
    storage.storage = createUploadEngine()
    const header = createPngHeader(320, 200)
    const rest = Buffer.from('rest of the image')
    // Split the header so the dimensions are only known after two chunks:
    const file = createUpload([
      header.subarray(0, 10),
      header.subarray(10),
      rest
    ])
    const result = await storage._handleUpload({}, file, {
      readDimensions: true
    })
    expect(file.width).toBe(320)
    expect(file.height).toBe(200)
    // The full data still reaches the multer storage:
    expect(result.data).toEqual(Buffer.concat([header, rest]))
    expect(storage.app.emit).not.toHaveBeenCalled()
  })

  it('reports media files without readable dimensions', async () => {
    const storage = createMemoryStorage()
    storage.storage = createUploadEngine()
    const file = createUpload([Buffer.from('not an image')], 'video/mp4')
    const result = await storage._handleUpload({}, file, {
      readDimensions: true
    })
    expect(file.width).toBeUndefined()
    expect(result.data.toString()).toBe('not an image')
    expect(storage.app.emit).toHaveBeenCalledWith(
      'error',
      'Unable to determine image size'
    )
  })

  // Bug: `_handleMediaFile()` writes `null` data to the pass-through stream
  // when the upload is empty, which throws ERR_STREAM_NULL_VALUES.
  test.fails('handles empty media uploads with `readDimensions`', async () => {
    const storage = createMemoryStorage()
    storage.storage = createUploadEngine()
    const stream = new PassThrough()
    const file = { originalname: 'empty.png', mimetype: 'image/png', stream }
    const promise = storage._handleUpload({}, file, { readDimensions: true })
    // Emit `end` directly, so a thrown error surfaces here and not as an
    // uncaught exception.
    expect(() => stream.emit('end')).not.toThrow()
    await promise
  })

  it('does not read dimensions of other file types', async () => {
    const storage = createMemoryStorage()
    storage.storage = createUploadEngine()
    const file = createUpload([createPngHeader(10, 10)], 'application/pdf')
    await storage._handleUpload({}, file, { readDimensions: true })
    expect(file.width).toBeUndefined()
  })

  it('does not read dimensions without `readDimensions`', async () => {
    const storage = createMemoryStorage()
    storage.storage = createUploadEngine()
    const file = createUpload([createPngHeader(10, 10)])
    await storage._handleUpload({}, file, {})
    expect(file.width).toBeUndefined()
  })
})
