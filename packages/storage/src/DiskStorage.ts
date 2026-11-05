import fs from 'node:fs/promises'
import path from 'node:path'
import {
  Storage,
  type AssetFile,
  type StorageOptions,
  type StoreData
} from './Storage.ts'

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

  getFilePath(file: AssetFile) {
    const filePath = path.resolve(
      this.path,
      this.#getNestedFolder(file.key),
      file.key
    )
    // Never address files outside of the storage folder or the folder itself,
    // whatever the key. `path.join()` also handles folders at the root.
    const folder = path.join(this.path, path.sep)
    if (!filePath.startsWith(folder) || filePath === folder) {
      throw new Error(`Invalid asset key: '${file.key}'`)
    }
    return filePath
  }

  override getFileUrl(file: AssetFile) {
    return this.getUrl(this.#getNestedFolder(file.key), file.key)
  }

  async addFile(file: AssetFile, data: StoreData) {
    const filePath = this.getFilePath(file)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    try {
      await fs.writeFile(filePath, data)
    } catch (error) {
      // Leave no partial file behind when the data fails to stream:
      await fs.rm(filePath, { force: true })
      throw error
    }
  }

  async removeFile(file: AssetFile) {
    await fs.unlink(this.getFilePath(file))
  }

  async readFile(file: AssetFile) {
    return fs.readFile(this.getFilePath(file))
  }

  async listKeys() {
    const entries = await fs.readdir(this.path, {
      recursive: true,
      withFileTypes: true
    })
    return entries
      .filter(entry => entry.isFile() && !entry.name.startsWith('.'))
      .map(entry => entry.name)
  }

  #getNestedFolder(key: string) {
    return this.nestedFolders ? path.posix.join(key[0], key[1]) : ''
  }
}
