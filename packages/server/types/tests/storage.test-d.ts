import { expectTypeOf, describe, it } from 'vitest'
import type multer from '@koa/multer'
import type Koa from 'koa'
import type { Storage, StorageFile, AssetFileObject } from '../index.d.ts'

describe('Storage', () => {
  const storage = {} as Storage

  describe('StorageFile', () => {
    it('inherits multer.File properties', () => {
      const file = {} as StorageFile
      expectTypeOf(file.originalname).toEqualTypeOf<string>()
      expectTypeOf(file.mimetype).toEqualTypeOf<string>()
      expectTypeOf(file.size).toEqualTypeOf<number>()
      expectTypeOf(file.key).toEqualTypeOf<string>()
    })

    it('is assignable to multer.File', () => {
      const storageFile = {} as StorageFile
      expectTypeOf(
        storageFile
      ).toMatchTypeOf<multer.File>()
    })

    it('multer.File is not assignable to StorageFile', () => {
      const multerFile = {} as multer.File
      expectTypeOf(
        multerFile
      ).not.toMatchTypeOf<StorageFile>()
    })
  })

  describe('convertStorageFile', () => {
    it('converts StorageFile to AssetFileObject', () => {
      const file = {} as StorageFile
      expectTypeOf(
        storage.convertStorageFile(file)
      ).toEqualTypeOf<AssetFileObject>()
    })

    it('converts array via convertStorageFiles', () => {
      const files = [] as StorageFile[]
      expectTypeOf(
        storage.convertStorageFiles(files)
      ).toEqualTypeOf<AssetFileObject[]>()
    })

    it('rejects plain objects', () => {
      // @ts-expect-error - not a StorageFile
      storage.convertStorageFile({ key: 'x' })
    })
  })

  describe('convertAssetFile', () => {
    it('accepts AssetFileObject', () => {
      const file: AssetFileObject = {
        key: 'abc.jpg',
        name: 'photo.jpg',
        type: 'image/jpeg',
        size: 1024,
        url: '/uploads/abc.jpg'
      }
      expectTypeOf(
        storage.convertAssetFile(file)
      ).toEqualTypeOf<void>()
    })

    it('rejects plain objects missing required fields', () => {
      // @ts-expect-error - missing required AssetFileObject fields
      storage.convertAssetFile({ key: 'x' })
    })
  })

  describe('getUploadStorage', () => {
    it('returns StorageEngine or null', () => {
      const result = storage.getUploadStorage({})
      expectTypeOf(result).toEqualTypeOf<multer.StorageEngine | null>()
    })
  })

  describe('getUploadHandler', () => {
    it('returns Koa middleware or null', () => {
      expectTypeOf(
        storage.getUploadHandler({})
      ).toEqualTypeOf<Koa.Middleware | null>()
    })

    it('accepts multer options', () => {
      storage.getUploadHandler({
        dest: '/tmp/uploads',
        limits: { fileSize: 1024 * 1024 }
      })
    })
  })
})
