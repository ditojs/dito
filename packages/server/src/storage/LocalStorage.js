import fs from 'fs-extra'
import path from 'path'
import uuidv4 from 'uuid/v4'
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
    this.multer = multer.diskStorage({
      destination(req, file, cb) {
        const uuid = uuidv4()
        file.filename = `${uuid}${path.extname(file.originalname)}`
        const dir = path.join(dest, uuid[0], uuid[1])
        fs.ensureDir(dir)
          .then(() => cb(null, dir))
          .catch(cb)
      },

      filename(req, file, cb) {
        cb(null, file.filename)
      }
    })
    this.dest = dest
  }

  getPath(file) {
    const filePath = path.join(file.destination, file.fileName)
    // Make sure that the file actually resides in this storage.
    return path.resolve(filePath).startsWith(path.resolve(this.dest))
      ? filePath
      : null
  }

  async removeFile(file) {
    const filePath = this.getPath(file)
    if (filePath) {
      await fs.unlink(filePath)
      const removeIfEmpty = async dir => {
        if ((await fs.readdir(dir)).length === 0) {
          await fs.rmdir(dir)
        }
      }
      // Clean up nested folders created with first two chars of filename also:
      const dir = path.dirname(filePath)
      const parentDir = path.dirname(dir)
      await (removeIfEmpty(dir))
      await (removeIfEmpty(parentDir))
      return true
    }
    return false
  }
}
