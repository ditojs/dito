import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DiskStorage, StorageRegistry, createStorages } from '../src/index.ts'
import { S3Storage } from '../src/s3-storage.ts'

const s3 = {
  bucket: 'books',
  s3: {
    region: 'eu-central-1',
    credentials: { accessKeyId: 'id', secretAccessKey: 'secret' }
  }
}

describe('createStorages()', () => {
  it('creates disk and S3 storages by name', async () => {
    const storages = await createStorages(
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

  it('resolves disk paths against the working directory', async () => {
    const storages = await createStorages({
      covers: { type: 'disk', path: 'a' }
    })
    expect((storages.get('covers') as DiskStorage).path).toBe(
      path.resolve('a')
    )
  })

  it('signs with the secret, unless a definition sets its own', async () => {
    const file = { key: 'a.png', name: 'a.png' }
    const storages = await createStorages(
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

  it('throws for unknown types and missing options', async () => {
    await expect(
      createStorages({ a: { type: 'ftp' } as never })
    ).rejects.toThrow(`Unknown type 'ftp' of storage 'a'`)
    await expect(
      createStorages({ a: { type: 'disk' } as never })
    ).rejects.toThrow(`Missing option 'path' for storage 'a'`)
  })
})

describe('the main entry', () => {
  it('loads neither the S3 storage nor aws-lite', () => {
    // A fresh process imports the entry and prints the URLs of the modules
    // that it loads.
    const index = fileURLToPath(new URL('../src/index.ts', import.meta.url))
    const { stdout, stderr } = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { registerHooks } from 'node:module'
        const urls = []
        registerHooks({
          load(url, context, next) {
            urls.push(url)
            return next(url, context)
          }
        })
        await import(${JSON.stringify(index)})
        console.log(JSON.stringify(urls))`
      ],
      { encoding: 'utf8' }
    )
    expect(stderr).toBe('')
    const urls: string[] = JSON.parse(stdout)
    expect(urls).toContainEqual(expect.stringMatching(/\/src\/registry\.ts$/))
    expect(urls.filter(url => /s3-storage|aws-lite/.test(url))).toEqual([])
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
