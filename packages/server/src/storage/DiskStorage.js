import fs from 'fs-extra'
import path from 'path'
import multer from 'koa-multer'
import { Storage } from './Storage'

export class DiskStorage extends Storage {
  static type = 'disk'

  constructor(app, config) {
    super(app, config)
    if (!config.path) {
      throw new Error(`Missing configuration (path) for storage ${this.name}`)
    }
    this.path = config.path

    this.setStorage(multer.diskStorage({
      destination: (req, file, cb) => {
        const filename = this.getUniqueFilename(file.originalname)
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

  getPath(...parts) {
    return this.path ? path.join(this.path, ...parts) : null
  }

  getFileName(file) {
    return file.filename
  }

  getFileProperties(name) {
    return {
      path: this.getFilePath(name),
      url: this.getFileUrl(name)
    }
  }

  async addFile(file, buffer) {
    const filePath = this.getFilePath(file.name)
    const dir = path.dirname(filePath)
    await fs.ensureDir(dir)
    await fs.writeFile(filePath, buffer)
    return {
      ...file,
      ...this.getFileProperties(file.name)
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

  getNestedFolder(name, posix = false) {
    // Store files in nested folders created with the first two chars of
    // filename, for faster access & management with large amounts of files.
    return (posix ? path.posix : path).join(name[0], name[1])
  }

  getFilePath(name) {
    return this.getPath(this.getNestedFolder(name), name)
  }

  getFileUrl(name) {
    return this.getUrl(this.getNestedFolder(name, true), name)
  }
}
