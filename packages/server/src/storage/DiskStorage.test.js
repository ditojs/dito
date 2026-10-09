import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { Readable } from 'stream'
import { DiskStorage } from './DiskStorage.js'
import { AssetFile } from './AssetFile.js'
import { Storage } from './index.js'

let basePath

beforeEach(async () => {
  basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-disk-storage-'))
})

afterEach(async () => {
  await fs.rm(basePath, { recursive: true, force: true })
})

async function createDiskStorage(config = {}) {
  const app = { keys: ['secret'], basePath }
  const storage = new DiskStorage(app, {
    name: 'covers',
    path: 'covers',
    url: 'https://library.example.com/covers/',
    ...config
  })
  await storage.setup()
  return storage
}

function getStoragePath(...parts) {
  return path.join(basePath, 'covers', ...parts)
}

function uploadFile(storage, { originalname, data, mimetype }, config = {}) {
  const uploadStorage = storage.getUploadStorage(config)
  const file = {
    fieldname: 'file',
    originalname,
    mimetype,
    stream: Readable.from([data])
  }
  return new Promise((resolve, reject) => {
    uploadStorage._handleFile({}, file, (err, info) =>
      err ? reject(err) : resolve({ ...file, ...info })
    )
  })
}

describe('DiskStorage', () => {
  it('is registered as the `disk` storage type', () => {
    expect(Storage.get('disk')).toBe(DiskStorage)
  })

  it('throws on setup without a configured path', async () => {
    const storage = new DiskStorage({ basePath }, { name: 'covers' })
    expect(() => storage.setup()).toThrow(
      'Missing configuration (path) for storage covers'
    )
  })

  describe('with nested folders (default)', () => {
    it('stores files in folders named after the first key chars', async () => {
      const storage = await createDiskStorage()
      expect(storage.nestedFolders).toBe(true)
      const file = AssetFile.create({ name: 'cover.txt', data: 'Front' })
      await storage.addFile(file, file.data)
      const [a, b] = file.key
      expect(storage.getFilePath(file)).toBe(getStoragePath(a, b, file.key))
      expect(await fs.readFile(getStoragePath(a, b, file.key), 'utf8')).toBe(
        'Front'
      )
      expect(file.url).toBe(
        `https://library.example.com/covers/${a}/${b}/${file.key}`
      )
      expect(file.size).toBe(5)
      expect((await storage.readFile(file)).toString()).toBe('Front')
    })

    it('lists the keys of nested files, ignoring hidden files', async () => {
      const storage = await createDiskStorage()
      const files = []
      for (const name of ['a.txt', 'b.txt', 'c.txt']) {
        const file = AssetFile.create({ name, data: name })
        await storage.addFile(file, file.data)
        files.push(file)
      }
      // Files and folders that don't follow the nesting scheme are ignored:
      await fs.writeFile(getStoragePath('.DS_Store'), '')
      await fs.writeFile(getStoragePath('stray.txt'), '')
      await fs.mkdir(getStoragePath('xy', 'z'), { recursive: true })
      await fs.writeFile(getStoragePath('xy', 'z', 'deep.txt'), '')
      const [a, b] = files[0].key
      await fs.writeFile(getStoragePath(a, b, '.hidden'), '')
      await fs.writeFile(getStoragePath(a, 'stray.txt'), '')
      const keys = await storage.listKeys()
      expect(keys.sort()).toEqual(files.map(file => file.key).sort())
    })

    it('removes files and their emptied folders', async () => {
      const storage = await createDiskStorage()
      const file = AssetFile.create({ name: 'a.txt', data: 'a' })
      await storage.addFile(file, file.data)
      await storage.removeFile(file)
      const [a, b] = file.key
      await expect(fs.access(getStoragePath(a, b))).rejects.toThrow()
      await expect(fs.access(getStoragePath(a))).rejects.toThrow()
      expect(await fs.readdir(getStoragePath())).toEqual([])
    })

    it('keeps folders that still contain other files', async () => {
      const storage = await createDiskStorage()
      const file = AssetFile.create({ name: 'a.txt', data: 'a' })
      await storage.addFile(file, file.data)
      const [a, b] = file.key
      const sibling = { key: `${a}${b}sibling.txt` }
      await storage.addFile(sibling, Buffer.from('b'))
      await storage.removeFile(file)
      expect(await fs.readdir(getStoragePath(a, b))).toEqual([sibling.key])
    })

    it('keeps the outer folder when it contains other folders', async () => {
      const storage = await createDiskStorage()
      const first = { key: 'abfirst.txt' }
      const second = { key: 'acsecond.txt' }
      await storage.addFile(first, Buffer.from('1'))
      await storage.addFile(second, Buffer.from('2'))
      await storage.removeFile(first)
      expect(await fs.readdir(getStoragePath('a'))).toEqual(['c'])
    })

    it('rejects when removing missing files', async () => {
      const storage = await createDiskStorage()
      await expect(
        storage.removeFile({ key: 'missing.txt' })
      ).rejects.toMatchObject({ code: 'ENOENT' })
    })

    it('stores uploaded files in nested folders', async () => {
      const storage = await createDiskStorage()
      const uploaded = await uploadFile(storage, {
        originalname: 'Back Cover.TXT',
        mimetype: 'text/plain',
        data: Buffer.from('Back')
      })
      expect(uploaded.key).toMatch(/\.txt$/)
      expect(uploaded.filename).toBe(uploaded.key)
      const [a, b] = uploaded.key
      expect(uploaded.path).toBe(getStoragePath(a, b, uploaded.key))
      expect(await fs.readFile(uploaded.path, 'utf8')).toBe('Back')
      const file = storage.convertStorageFile(uploaded)
      expect(file).toMatchObject({
        key: uploaded.key,
        name: 'Back Cover.TXT',
        type: 'text/plain',
        size: 4,
        url: `https://library.example.com/covers/${a}/${b}/${uploaded.key}`
      })
      expect(await storage.listKeys()).toEqual([uploaded.key])
    })
  })

  describe('without nested folders', () => {
    it('stores, lists and removes files in the storage folder', async () => {
      const storage = await createDiskStorage({ nestedFolders: false })
      const file = AssetFile.create({ name: 'a.txt', data: 'a' })
      await storage.addFile(file, file.data)
      expect(storage.getFilePath(file)).toBe(getStoragePath(file.key))
      expect(file.url).toBe(`https://library.example.com/covers/${file.key}`)
      await fs.writeFile(getStoragePath('.hidden'), '')
      expect(await storage.listKeys()).toEqual([file.key])
      await storage.removeFile(file)
      expect(await fs.readdir(getStoragePath())).toEqual(['.hidden'])
    })

    it('stores uploaded files in the storage folder', async () => {
      const storage = await createDiskStorage({ nestedFolders: false })
      const uploaded = await uploadFile(storage, {
        originalname: 'cover.txt',
        mimetype: 'text/plain',
        data: Buffer.from('Cover')
      })
      expect(uploaded.path).toBe(getStoragePath(uploaded.key))
    })
  })

  it('reads image dimensions of uploads with `readDimensions`', async () => {
    const storage = await createDiskStorage()
    const header = Buffer.alloc(33)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header)
    header.writeUInt32BE(13, 8)
    header.write('IHDR', 12)
    header.writeUInt32BE(64, 16)
    header.writeUInt32BE(48, 20)
    const uploaded = await uploadFile(
      storage,
      { originalname: 'cover.png', mimetype: 'image/png', data: header },
      { readDimensions: true }
    )
    expect(storage.convertStorageFile(uploaded)).toMatchObject({
      width: 64,
      height: 48,
      size: 33
    })
    expect(await fs.readFile(uploaded.path)).toEqual(header)
  })

  it('passes errors when the upload folder cannot be created', async () => {
    const storage = await createDiskStorage()
    // A file where the storage folder should be makes `mkdir()` fail.
    await fs.writeFile(getStoragePath(), '')
    await expect(
      uploadFile(storage, {
        originalname: 'a.txt',
        mimetype: 'text/plain',
        data: Buffer.from('a')
      })
    ).rejects.toMatchObject({ code: expect.stringMatching(/EEXIST|ENOTDIR/) })
  })
})
