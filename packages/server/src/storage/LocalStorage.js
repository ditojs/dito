import fs from 'fs-extra'
import path from 'path'
import multer from 'koa-multer'
import { Storage } from './Storage'

export class LocalStorage extends Storage {
  static type = 'local'

  constructor(config) {
    super(config)
    const { dest } = config
    if (!dest) {
      throw new Error(`Missing configuration (dest) for storage ${this.name}`)
    }
    this.dest = dest
    this.setStorage(multer.diskStorage({
      destination: (req, file, cb) => {
        const filename = this.getFilename(file)
        file.filename = filename
        const dir = this.getNestedFolder(file)
        fs.ensureDir(dir)
          .then(() => cb(null, dir))
          .catch(cb)
      },

      filename: (req, file, cb) => {
        cb(null, file.filename)
      }
    }))
  }

  getNestedFolder(file) {
    // Store files in nested folders created with the first two chars of
    // filename, for faster access & management with large amounts of files.
    const { filename } = file
    return `${this.dest}${path.sep}${filename[0]}${path.sep}${filename[1]}`
  }

  getFileIdentifiers(file) {
    return {
      name: file.filename,
      path: file.destination,
      // TODO:
      location: ''
    }
  }

  managesFile(file) {
    return file && file.path.startsWith(this.dest)
  }

  async deleteFile(file) {
    const filePath = path.join(file.path, file.name)
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
