import path from 'node:path'
import { defineEntity, p } from '@mikro-orm/core'
import { createAdmin } from '@ditojs/admin/server'
import { createApp } from './index.ts'
import { getResolvedUrls } from '../../../tests/utils/imports.ts'

vi.mock('@ditojs/admin/server', async importOriginal => {
  const { createAdmin } =
    await importOriginal<typeof import('@ditojs/admin/server')>()
  return { createAdmin: vi.fn(createAdmin) }
})

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    title: p.string()
  }
})
class Book extends BookSchema.class {}
BookSchema.setClass(Book)

const root = path.join(import.meta.dirname, '../../admin/src/test/admin-app')

describe('the main entry', () => {
  it('loads no Vue', () => {
    const index = path.join(import.meta.dirname, 'index.ts')
    const urls = getResolvedUrls(`await import(${JSON.stringify(index)})`)
    expect(urls.some(url => url.endsWith('/admin/src/server/index.ts'))).toBe(
      true
    )
    expect(urls.filter(url => /\/node_modules\/vue\//.test(url))).toEqual([])
  })
})

describe('app.routeAdmin()', () => {
  const createAdminApp = () =>
    createApp({
      entities: [Book],
      database: { dbName: 'dito_kit_admin' },
      logger: { level: 'silent' }
    })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(createAdmin).mockClear()
  })

  it('routes the admin, with its path as `base`', async () => {
    const app = createAdminApp()
    app.routeAdmin('/admin', { dist: root, settings: { language: 'en' } })
    const response = await app.hono.request('/admin/dito.js')
    const script = await response.text()
    expect(script).toContain('"base": "/admin"')
    expect(script).toContain('"language": "en"')
    await app.close()
  })

  it('leaves out `vite` outside of development', async () => {
    const app = createAdminApp()
    const vite = {
      root,
      configFile: false as const,
      logLevel: 'silent' as const
    }
    app.routeAdmin('/admin', { dist: root, vite })
    expect(vi.mocked(createAdmin).mock.calls[0]![0].vite).toBeUndefined()
    await app.close()
  })

  it('stops Vite with `close()`, also without a start', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const app = createAdminApp()
    const vite = {
      root,
      configFile: false as const,
      logLevel: 'silent' as const
    }
    app.routeAdmin('/admin', { vite })
    const admin = vi.mocked(createAdmin).mock.results[0]!.value
    const stop = vi.spyOn(admin, 'stop')
    await app.close()
    expect(vi.mocked(createAdmin).mock.calls[0]![0].vite).toBe(vite)
    expect(stop).toHaveBeenCalledOnce()
  }, 20000)
})
