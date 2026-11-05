import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DiskStorage, type DiskStorageOptions } from './index.ts'

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
    path: getStoragePath(),
    url: 'https://library.example.com/covers/',
    ...options
  })
}

function getStoragePath(...parts: string[]) {
  return path.join(basePath, 'covers', ...parts)
}

function store(storage: DiskStorage, name: string, data: string | Buffer) {
  return storage.store({ name, data: Buffer.from(data) })
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
      const file = await store(storage, 'Back Cover.TXT', 'Back')
      expect(file.key).toMatch(/\.txt$/)
      const [a, b] = file.key
      const filePath = getStoragePath(a, b, file.key)
      expect(storage.getFilePath(file)).toBe(filePath)
      expect(await fs.readFile(filePath, 'utf8')).toBe('Back')
      expect(file).toMatchObject({
        name: 'Back Cover.TXT',
        size: 4,
        url: `https://library.example.com/covers/${a}/${b}/${file.key}`
      })
      expect((await storage.readFile(file)).toString()).toBe('Back')
    })

    it('lists the keys of all files, ignoring hidden files', async () => {
      const storage = createDiskStorage()
      const files = []
      for (const name of ['a.txt', 'b.txt', 'c.txt']) {
        files.push(await store(storage, name, name))
      }
      const [a, b] = files[0].key
      await fs.writeFile(getStoragePath('.DS_Store'), '')
      await fs.writeFile(getStoragePath(a, b, '.hidden'), '')
      const keys = await storage.listKeys()
      expect(keys.sort()).toEqual(files.map(file => file.key).sort())
    })

    it('removes files', async () => {
      const storage = createDiskStorage()
      const file = await store(storage, 'a.txt', 'a')
      await storage.removeFile(file)
      expect(await storage.listKeys()).toEqual([])
    })

    it('rejects when removing missing files', async () => {
      const storage = createDiskStorage()
      await expect(
        storage.removeFile({ key: 'missing.txt' })
      ).rejects.toMatchObject({ code: 'ENOENT' })
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
      const file = await store(storage, 'a.txt', 'a')
      expect(storage.getFilePath(file)).toBe(getStoragePath(file.key))
      expect(file.url).toBe(`https://library.example.com/covers/${file.key}`)
      await fs.writeFile(getStoragePath('.hidden'), '')
      expect(await storage.listKeys()).toEqual([file.key])
      await storage.removeFile(file)
      expect(await fs.readdir(getStoragePath())).toEqual(['.hidden'])
    })
  })

  it('passes errors when the folder cannot be created', async () => {
    const storage = createDiskStorage()
    // A file where the storage folder should be makes `mkdir()` fail.
    await fs.writeFile(getStoragePath(), '')
    await expect(store(storage, 'a.txt', 'a')).rejects.toMatchObject({
      code: expect.stringMatching(/EEXIST|ENOTDIR/)
    })
  })
})
