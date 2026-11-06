import fs from 'node:fs/promises'
import path from 'node:path'
import {
  Storage,
  isValidKey,
  type AssetFile,
  type FileData,
  type StorageOptions
} from './Storage.ts'

export interface DiskStorageOptions extends StorageOptions {
  // The folder of the files, resolved against the working directory.
  path: string
  // Put each file into two levels of folders named after the first two
  // characters of its key, such as `3/f/3f2b….png`, to keep folders small.
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
    // Never address files outside of the storage folder, whatever the key:
    if (!isValidKey(file.key)) {
      throw new Error(`Invalid asset key: '${file.key}'`)
    }
    return path.resolve(this.path, this.#getNestedFolder(file.key), file.key)
  }

  override getFileUrl(file: AssetFile) {
    return this.getUrl(this.#getNestedFolder(file.key), file.key)
  }

  async addFile(file: AssetFile, data: FileData) {
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
