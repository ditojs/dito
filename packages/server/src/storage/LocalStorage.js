import fs from 'fs-extra'
import path from 'path'
import { URL } from 'url'
import multer from 'koa-multer'
import { Storage } from './Storage'

export class LocalStorage extends Storage {
  static type = 'local'

  constructor(config) {
    super(config)
    if (!config.path) {
      throw new Error(`Missing configuration (path) for storage ${this.name}`)
    }
    this.path = config.path
    this.url = config.url

    this.setStorage(multer.diskStorage({
      destination: (req, file, cb) => {
        const filename = this.getFilename(file)
        file.filename = filename
        const dir = path.join(this.path, this.getNestedFolder(filename))
        fs.ensureDir(dir)
          .then(() => cb(null, dir))
          .catch(cb)
      },

      filename: (req, file, cb) => {
        cb(null, file.filename)
      }
    }))
  }

  getNestedFolder(name, posix = false) {
    // Store files in nested folders created with the first two chars of
    // filename, for faster access & management with large amounts of files.
    return (posix ? path.posix : path).join(name[0], name[1])
  }

  getFilePath(name) {
    return path.join(this.path, this.getNestedFolder(name), name)
  }

  getFileIdentifiers(file) {
    const name = file.filename
    return {
      name,
      url: (
        this.url &&
        new URL(
          path.posix.join(this.getNestedFolder(name, true), name),
          this.url
        )
      )
    }
  }

  async removeFile(file) {
    const filePath = this.getFilePath(file.name)
    await fs.unlink(filePath)
    const removeIfEmpty = async dir => {
      if ((await fs.readdir(dir)).length === 0) {
        await fs.rmdir(dir)
      }
    }
    // Clean up nested folders created with first two chars of filename also:
    const dir = path.dirname(filePath)
    const parentDir = path.dirname(dir)
    await removeIfEmpty(dir)
    await removeIfEmpty(parentDir)
  }
}
