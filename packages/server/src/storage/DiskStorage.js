import fs from 'fs-extra'
import path from 'path'
import multer from '@koa/multer'
import { Storage } from './Storage.js'

export class DiskStorage extends Storage {
  static type = 'disk'

  constructor(app, config) {
    super(app, config)
    if (!this.path) {
      throw new Error(`Missing configuration (path) for storage ${this.name}`)
    }

    this.storage = multer.diskStorage({
      destination: (req, storageFile, cb) => {
        // Add `storageFile.key` property to internal storage file object.
        storageFile.key = this.getUniqueKey(storageFile.originalname)
        const dir = this._getPath(this._getNestedFolder(storageFile.key))
        fs.ensureDir(dir)
          .then(() => cb(null, dir))
          .catch(cb)
      },

      filename: (req, storageFile, cb) => {
        // Use added `storageFile.key` property for multer's `filename` also.
        cb(null, storageFile.key)
      }
    })
  }

  // @override
  _getFilePath(file) {
    return this._getPath(this._getNestedFolder(file.key), file.key)
  }

  // @override
  _getFileUrl(file) {
    return this._getUrl(this._getNestedFolder(file.key, true), file.key)
  }

  // @override
  async _addFile(file, buffer) {
    const filePath = this._getFilePath(file)
    const dir = path.dirname(filePath)
    await fs.ensureDir(dir)
    await fs.writeFile(filePath, buffer)
    return file
  }

  // @override
  async _removeFile(file) {
    const filePath = this._getFilePath(file)
    await fs.unlink(filePath)
    const removeIfEmpty = async dir => {
      if ((await fs.readdir(dir)).length === 0) {
        try {
          await fs.rmdir(dir)
        } catch (err) {
          // The directory may already have been deleted by another async call,
          // fail silently here in this case.
          if (err.code !== 'ENOENT') {
            throw err
          }
        }
      }
    }
    // Clean up nested folders created with first two chars of `file.key` also:
    const dir = path.dirname(filePath)
    const parentDir = path.dirname(dir)
    await removeIfEmpty(dir)
    await removeIfEmpty(parentDir)
  }

  // @override
  async _readFile(file) {
    return fs.readFile(this._getFilePath(file))
  }

  // @override
  async _listKeys() {
    const readDir = (...parts) =>
      fs.readdir(this._getPath(...parts), { withFileTypes: true })

    const files = []
    const list1 = await readDir()
    await Promise.all(
      list1.map(async level1 => {
        if (level1.isDirectory() && level1.name.length === 1) {
          const list2 = await readDir(level1.name)
          await Promise.all(
            list2.map(async level2 => {
              if (level2.isDirectory() && level2.name.length === 1) {
                const nestedFolder = this._getPath(level1.name, level2.name)
                for (const file of await fs.readdir(nestedFolder)) {
                  if (!file.startsWith('.')) {
                    files.push(file)
                  }
                }
              }
            })
          )
        }
      })
    )
    return files
  }

  _getNestedFolder(key, posix = false) {
    // Store files in nested folders created with the first two chars of the
    // key, for faster access & management with large amounts of files.
    return (posix ? path.posix : path).join(key[0], key[1])
  }
}
