import path from 'node:path'
import {
  DiskStorage,
  S3Storage,
  StorageRegistry,
  createStorages
} from '../src/index.ts'

const s3 = {
  bucket: 'books',
  s3: {
    region: 'eu-central-1',
    credentials: { accessKeyId: 'id', secretAccessKey: 'secret' }
  }
}

describe('createStorages()', () => {
  it('creates disk and S3 storages by name', () => {
    const storages = createStorages(
      {
        covers: { type: 'disk', path: 'storage/covers', url: '/covers/' },
        archive: { type: 's3', ...s3 }
      },
      { secret: 'secret', basePath: '/app' }
    )
    const covers = storages.get('covers') as DiskStorage
    expect(covers).toBeInstanceOf(DiskStorage)
    expect(covers.name).toBe('covers')
    expect(covers.path).toBe(path.resolve('/app/storage/covers'))
    expect(covers.url).toBe('/covers/')
    expect(storages.get('archive')).toBeInstanceOf(S3Storage)
    expect(storages.names).toEqual(['covers', 'archive'])
  })

  it('resolves disk paths against the working directory', () => {
    const storages = createStorages({ covers: { type: 'disk', path: 'a' } })
    expect((storages.get('covers') as DiskStorage).path).toBe(
      path.resolve('a')
    )
  })

  it('signs with the secret, unless a definition sets its own', () => {
    const file = { key: 'a.png', name: 'a.png' }
    const storages = createStorages(
      {
        a: { type: 'disk', path: 'a' },
        b: { type: 'disk', path: 'b' },
        c: { type: 'disk', path: 'c', secret: 'other' }
      },
      { secret: 'secret' }
    )
    const signed = { ...file }
    storages.get('a').signAssetFile(signed)
    expect(storages.get('b').verifyAssetFile(signed)).toBe(true)
    expect(storages.get('c').verifyAssetFile(signed)).toBe(false)
  })

  it('throws for unknown types and missing options', () => {
    expect(() => createStorages({ a: { type: 'ftp' } as never })).toThrow(
      `Unknown type 'ftp' of storage 'a'`
    )
    expect(() => createStorages({ a: { type: 'disk' } as never })).toThrow(
      `Missing option 'path' for storage 'a'`
    )
  })
})

describe('StorageRegistry', () => {
  const covers = new DiskStorage({ name: 'covers', path: 'covers' })
  const archive = new DiskStorage({ name: 'archive', path: 'archive' })

  it('throws for unknown names', () => {
    const storages = new StorageRegistry([covers])
    expect(storages.has('covers')).toBe(true)
    expect(storages.has('archive')).toBe(false)
    expect(() => storages.get('archive')).toThrow(`Unknown storage 'archive'`)
  })

  it('iterates over names and storages', () => {
    const storages = new StorageRegistry([covers, archive])
    expect([...storages]).toEqual([
      ['covers', covers],
      ['archive', archive]
    ])
    expect([...storages.values()]).toEqual([covers, archive])
  })

  it('takes storages by name', () => {
    const storages = new StorageRegistry({ front: covers })
    expect(storages.get('front')).toBe(covers)
  })
})
