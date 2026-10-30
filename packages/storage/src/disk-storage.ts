import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import { mapConcurrently } from '@ditojs/utils'
import { Storage, type StorageOptions, type UploadInfo } from './storage.ts'
import type { AssetFileObject } from './asset-file.ts'
import { AssetError } from './errors.ts'

// Stores files in a folder. With `nestedFolders`, each file goes into two
// levels of folders named after the first two characters of its key, such as
// `3/f/3f2b….png`, which keeps folders small with many files.

export interface DiskStorageOptions extends StorageOptions {
  // The folder of the files, resolved against the working directory.
  path: string
  nestedFolders?: boolean
}

export class DiskStorage extends Storage {
  path: string
  nestedFolders: boolean

  constructor({
    path: folder,
    nestedFolders = true,
    ...rest
  }: DiskStorageOptions) {
    super(rest)
    if (!folder) {
      throw new Error(`Missing option 'path' for storage '${this.name}'`)
    }
    this.path = path.resolve(folder)
    this.nestedFolders = nestedFolders
  }

  protected override _getFilePath(file: AssetFileObject) {
    const filePath = this.#getPath(this.#getNestedFolder(file.key), file.key)
    // Never address files outside of the storage folder or the folder itself,
    // whatever the key. `path.join()` also handles folders at the root.
    const folder = path.join(this.path, path.sep)
    if (!filePath.startsWith(folder) || filePath === folder) {
      throw new AssetError(`Invalid asset key: '${file.key}'`)
    }
    return filePath
  }

  protected override _getFileUrl(file: AssetFileObject) {
    return this._getUrl(this.#getNestedFolder(file.key, true), file.key)
  }

  protected override async _upload(
    key: string,
    stream: Readable,
    _info: UploadInfo
  ) {
    const filePath = this._getFilePath({ key })
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    let size = 0
    try {
      await pipeline(
        stream,
        async function* (source: AsyncIterable<Buffer>) {
          for await (const chunk of source) {
            size += chunk.length
            yield chunk
          }
        },
        createWriteStream(filePath)
      )
    } catch (error) {
      await fs.rm(filePath, { force: true })
      throw error
    }
    return { size }
  }

  protected async _addFile(file: AssetFileObject, data: Buffer) {
    const filePath = this._getFilePath(file)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, data)
  }

  protected async _removeFile(file: AssetFileObject) {
    const filePath = this._getFilePath(file)
    await fs.unlink(filePath)
    if (this.nestedFolders) {
      const dir = path.dirname(filePath)
      if (await removeIfEmpty(dir)) {
        await removeIfEmpty(path.dirname(dir))
      }
    }
  }

  protected async _readFile(file: AssetFileObject) {
    return fs.readFile(this._getFilePath(file))
  }

  protected async _listKeys() {
    if (!this.nestedFolders) {
      return (await fs.readdir(this.path)).filter(isVisible)
    }
    const readDir = (...parts: string[]) =>
      fs.readdir(this.#getPath(...parts), { withFileTypes: true })
    // Only the folders of the nesting scheme hold files:
    const isNestedFolder = (entry: {
      name: string
      isDirectory(): boolean
    }) => entry.isDirectory() && entry.name.length === 1
    const keys: string[] = []
    await mapConcurrently(await readDir(), async level1 => {
      if (isNestedFolder(level1)) {
        await mapConcurrently(await readDir(level1.name), async level2 => {
          if (isNestedFolder(level2)) {
            const folder = this.#getPath(level1.name, level2.name)
            keys.push(...(await fs.readdir(folder)).filter(isVisible))
          }
        })
      }
    })
    return keys
  }

  #getPath(...parts: string[]) {
    return path.resolve(this.path, ...parts)
  }

  #getNestedFolder(key: string, posix = false) {
    return this.nestedFolders
      ? (posix ? path.posix : path).join(key[0], key[1])
      : ''
  }
}

function isVisible(name: string) {
  return !name.startsWith('.')
}

async function removeIfEmpty(dir: string) {
  try {
    if ((await fs.readdir(dir)).length === 0) {
      await fs.rmdir(dir)
      return true
    }
  } catch (error) {
    // Another call may have removed the folder in the meantime.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return false
}
