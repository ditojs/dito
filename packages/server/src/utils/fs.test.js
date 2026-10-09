import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { exists, removeIfEmpty } from './fs.js'

let dir

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-fs-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('exists()', () => {
  it('returns true for existing files and directories', async () => {
    const file = path.join(dir, 'chapter.txt')
    await fs.writeFile(file, 'Once upon a time')
    expect(await exists(file)).toBe(true)
    expect(await exists(dir)).toBe(true)
  })

  it('returns false for missing paths', async () => {
    expect(await exists(path.join(dir, 'missing.txt'))).toBe(false)
  })
})

describe('removeIfEmpty()', () => {
  it('removes empty directories and returns true', async () => {
    const empty = path.join(dir, 'empty')
    await fs.mkdir(empty)
    expect(await removeIfEmpty(empty)).toBe(true)
    expect(await exists(empty)).toBe(false)
  })

  it('keeps directories with content and returns false', async () => {
    await fs.writeFile(path.join(dir, 'chapter.txt'), '')
    expect(await removeIfEmpty(dir)).toBe(false)
    expect(await exists(dir)).toBe(true)
  })

  it('returns false for directories that were already removed', async () => {
    expect(await removeIfEmpty(path.join(dir, 'gone'))).toBe(false)
  })

  it('rethrows errors other than missing directories', async () => {
    const file = path.join(dir, 'chapter.txt')
    await fs.writeFile(file, '')
    await expect(removeIfEmpty(file)).rejects.toMatchObject({
      code: 'ENOTDIR'
    })
  })
})
