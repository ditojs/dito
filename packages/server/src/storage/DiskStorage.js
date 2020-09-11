import fs from 'fs-extra'
import path from 'path'
import multer from '@koa/multer'
import { Storage } from './Storage'

export class DiskStorage extends Storage {
  static type = 'disk'

  constructor(app, config) {
    super(app, config)
    if (!this.path) {
      throw new Error(`Missing configuration (path) for storage ${this.name}`)
    }

    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const filename = this.getUniqueFilename(file.originalname)
        file.filename = filename
        const dir = this._getPath(this._getNestedFolder(filename))
        fs.ensureDir(dir)
          .then(() => cb(null, dir))
          .catch(cb)
      },

      filename: (req, file, cb) => {
        cb(null, file.filename)
      }
    })
  }

  // @override
  _getFileName(file) {
    return file.filename
  }

  // @override
  _getStorageProperties(name) {
    return {
      path: this._getFilePath(name, true),
      url: this._getFileUrl(name)
    }
  }

  // @override
  _extractStorageProperties(file) {
    return {
      path: file.path,
      url: file.url
    }
  }

  // @override
  async _addFile(file, buffer) {
    const filePath = this._getFilePath(file.name)
    const dir = path.dirname(filePath)
    await fs.ensureDir(dir)
    await fs.writeFile(filePath, buffer)
    return file
  }

  // @override
  async _removeFile(file) {
    const filePath = this._getFilePath(file.name)
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

  // @override
  async _readFile(file) {
    const { path } = file
    // Dito used to store paths absolutely, so check if a call of `_getPath()`
    // is required for the time being.
    // TODO: Absolute paths are deprecated, remove once all data is converted.
    return fs.readFile(path.startsWith(this.path) ? path : this._getPath(path))
  }

  // @override
  _areFilesEqual(_file1, _file2) {
    return _file1.path === _file2.path
  }

  _getNestedFolder(name, posix = false) {
    // Store files in nested folders created with the first two chars of
    // filename, for faster access & management with large amounts of files.
    return (posix ? path.posix : path).join(name[0], name[1])
  }

  _getFilePath(name, relative = false) {
    const dir = this._getNestedFolder(name)
    return relative
      ? path.join(dir, name)
      : this._getPath(dir, name)
  }

  _getFileUrl(name) {
    return this._getUrl(this._getNestedFolder(name, true), name)
  }
}
