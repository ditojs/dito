import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import {
  AssetFile,
  DiskStorage,
  type DiskStorageOptions,
  type Upload,
  type UploadOptions
} from '../src/index.ts'

let basePath: string

beforeEach(async () => {
  basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-disk-storage-'))
})

afterEach(async () => {
  await fs.rm(basePath, { recursive: true, force: true })
})

function createDiskStorage(options: Partial<DiskStorageOptions> = {}) {
  return new DiskStorage({
    name: 'covers',
    secret: 'secret',
    path: getStoragePath(),
    url: 'https://library.example.com/covers/',
    ...options
  })
}

function getStoragePath(...parts: string[]) {
  return path.join(basePath, 'covers', ...parts)
}

function uploadFile(
  storage: DiskStorage,
  { name, type, data }: Omit<Upload, 'stream'> & { data: Buffer },
  options?: UploadOptions
) {
  return storage.upload({ name, type, stream: Readable.from([data]) }, options)
}

describe('DiskStorage', () => {
  it('throws without path', () => {
    expect(() => new DiskStorage({ name: 'covers' } as any)).toThrow(
      `Missing option 'path' for storage 'covers'`
    )
  })

  it('resolves relative paths against the working directory', () => {
    const storage = createDiskStorage({ path: 'uploads' })
    expect(storage.path).toBe(path.resolve('uploads'))
  })

  describe('with nested folders (default)', () => {
    it('stores files in folders named after the first key chars', async () => {
      const storage = createDiskStorage()
      expect(storage.nestedFolders).toBe(true)
      const file = AssetFile.create({ name: 'cover.txt', data: 'Front' })
      await storage.addFile(file, file.data!)
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
      const storage = createDiskStorage()
      const files = []
      for (const name of ['a.txt', 'b.txt', 'c.txt']) {
        const file = AssetFile.create({ name, data: name })
        await storage.addFile(file, file.data!)
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
      const storage = createDiskStorage()
      const file = AssetFile.create({ name: 'a.txt', data: 'a' })
      await storage.addFile(file, file.data!)
      await storage.removeFile(file)
      const [a, b] = file.key
      await expect(fs.access(getStoragePath(a, b))).rejects.toThrow()
      await expect(fs.access(getStoragePath(a))).rejects.toThrow()
      expect(await fs.readdir(getStoragePath())).toEqual([])
    })

    it('keeps folders that still contain other files', async () => {
      const storage = createDiskStorage()
      const file = AssetFile.create({ name: 'a.txt', data: 'a' })
      await storage.addFile(file, file.data!)
      const [a, b] = file.key
      const sibling = { key: `${a}${b}sibling.txt` }
      await storage.addFile(sibling, Buffer.from('b'))
      await storage.removeFile(file)
      expect(await fs.readdir(getStoragePath(a, b))).toEqual([sibling.key])
    })

    it('keeps the outer folder when it contains other folders', async () => {
      const storage = createDiskStorage()
      const first = { key: 'abfirst.txt' }
      const second = { key: 'acsecond.txt' }
      await storage.addFile(first, Buffer.from('1'))
      await storage.addFile(second, Buffer.from('2'))
      await storage.removeFile(first)
      expect(await fs.readdir(getStoragePath('a'))).toEqual(['c'])
    })

    it('rejects when removing missing files', async () => {
      const storage = createDiskStorage()
      await expect(
        storage.removeFile({ key: 'missing.txt' })
      ).rejects.toMatchObject({ code: 'ENOENT' })
    })

    it('stores uploaded files in nested folders', async () => {
      const storage = createDiskStorage()
      const file = await uploadFile(storage, {
        name: 'Back Cover.TXT',
        type: 'text/plain',
        data: Buffer.from('Back')
      })
      expect(file.key).toMatch(/\.txt$/)
      const [a, b] = file.key
      const filePath = getStoragePath(a, b, file.key)
      expect(storage.getFilePath(file)).toBe(filePath)
      expect(await fs.readFile(filePath, 'utf8')).toBe('Back')
      expect(file).toMatchObject({
        name: 'Back Cover.TXT',
        type: 'text/plain',
        size: 4,
        url: `https://library.example.com/covers/${a}/${b}/${file.key}`
      })
      expect(storage.verifyAssetFile(file)).toBe(true)
      expect(await storage.listKeys()).toEqual([file.key])
    })
  })

  it('keeps the paths of files inside the storage folder', async () => {
    const storage = createDiskStorage({ nestedFolders: false })
    const outside = path.join(basePath, 'outside.txt')
    await fs.writeFile(outside, 'Outside')
    expect(() => storage.getFilePath({ key: '../outside.txt' })).toThrow(
      `Invalid asset key: '../outside.txt'`
    )
    await expect(storage.removeFile({ key: '../outside.txt' })).rejects.toThrow(
      `Invalid asset key: '../outside.txt'`
    )
    await expect(storage.readFile({ key: '../outside.txt' })).rejects.toThrow(
      `Invalid asset key: '../outside.txt'`
    )
    expect(await fs.readFile(outside, 'utf8')).toBe('Outside')
  })

  it('keeps the paths of files of storages at the filesystem root', () => {
    const storage = new DiskStorage({ name: 'root', path: '/' })
    expect(storage.getFilePath({ key: 'ab.txt' })).toBe(
      path.resolve('/', 'a', 'b', 'ab.txt')
    )
    expect(() => storage.getFilePath({ key: '..' })).toThrow(
      `Invalid asset key: '..'`
    )
  })

  describe('without nested folders', () => {
    it('stores, lists and removes files in the storage folder', async () => {
      const storage = createDiskStorage({ nestedFolders: false })
      const file = AssetFile.create({ name: 'a.txt', data: 'a' })
      await storage.addFile(file, file.data!)
      expect(storage.getFilePath(file)).toBe(getStoragePath(file.key))
      expect(file.url).toBe(`https://library.example.com/covers/${file.key}`)
      await fs.writeFile(getStoragePath('.hidden'), '')
      expect(await storage.listKeys()).toEqual([file.key])
      await storage.removeFile(file)
      expect(await fs.readdir(getStoragePath())).toEqual(['.hidden'])
    })

    it('stores uploaded files in the storage folder', async () => {
      const storage = createDiskStorage({ nestedFolders: false })
      const file = await uploadFile(storage, {
        name: 'cover.txt',
        type: 'text/plain',
        data: Buffer.from('Cover')
      })
      expect(await fs.readFile(getStoragePath(file.key), 'utf8')).toBe('Cover')
    })
  })

  it('reads image dimensions of uploads with `readDimensions`', async () => {
    const storage = createDiskStorage()
    const header = Buffer.alloc(33)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header)
    header.writeUInt32BE(13, 8)
    header.write('IHDR', 12)
    header.writeUInt32BE(64, 16)
    header.writeUInt32BE(48, 20)
    const file = await uploadFile(
      storage,
      { name: 'cover.png', type: 'image/png', data: header },
      { readDimensions: true }
    )
    expect(file).toMatchObject({ width: 64, height: 48, size: 33 })
    expect(await fs.readFile(storage.getFilePath(file)!)).toEqual(header)
  })

  it('passes errors when the upload folder cannot be created', async () => {
    const storage = createDiskStorage()
    // A file where the storage folder should be makes `mkdir()` fail.
    await fs.writeFile(getStoragePath(), '')
    await expect(
      uploadFile(storage, {
        name: 'a.txt',
        type: 'text/plain',
        data: Buffer.from('a')
      })
    ).rejects.toMatchObject({ code: expect.stringMatching(/EEXIST|ENOTDIR/) })
  })

  it('removes partly written files of failed uploads', async () => {
    const storage = createDiskStorage({ nestedFolders: false })
    let sent = false
    const stream = new Readable({
      read() {
        if (sent) {
          this.destroy(new Error('Connection lost'))
        } else {
          sent = true
          this.push(Buffer.from('partial'))
        }
      }
    })
    await expect(storage.upload({ name: 'a.txt', stream })).rejects.toThrow(
      'Connection lost'
    )
    expect(await fs.readdir(getStoragePath())).toEqual([])
  })
})
