import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { AdminController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'

class Admin extends AdminController {
  override authorize: any = 'editor'
}

describe('AdminController hosting', () => {
  let dist: string
  let app: ReturnType<typeof createTestApp>
  let url: string

  beforeAll(async () => {
    dist = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-admin-'))
    await fs.writeFile(path.join(dist, 'index.html'), '<title>Library</title>')
    await fs.writeFile(path.join(dist, 'main.js'), 'console.log("admin")')
    app = createTestApp({
      controllers: { Admin },
      config: {
        admin: {
          mode: 'production',
          dist,
          settings: { theme: 'dark' }
        }
      }
    })
    await app.start()
    url = getAppUrl(app)
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
    await fs.rm(dist, { recursive: true, force: true })
  })

  it('serves the built SPA for all sub-routes', async () => {
    for (const route of ['/admin', '/admin/books/12', '/admin/authors']) {
      const response = await fetch(`${url}${route}`)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('<title>Library</title>')
    }
  })

  it('serves script and style assets directly', async () => {
    const response = await fetch(`${url}/admin/main.js`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('console.log("admin")')
    const missing = await fetch(`${url}/admin/missing.css`)
    expect(missing.status).toBe(404)
  })

  it('serves the `dito` object as a script', async () => {
    const response = await fetch(`${url}/admin/dito.js`)
    expect(response.headers.get('content-type')).toMatch(/javascript/)
    const script = await response.text()
    const match = script.match(/^window\.dito = ([\s\S]*)$/)
    expect(JSON.parse(match![1])).toEqual({
      base: '/admin',
      api: { normalizePaths: true },
      settings: { theme: 'dark' }
    })
  })

  it('authorizes access to the admin views', async () => {
    const response = await fetch(`${url}/admin/views/books`)
    expect(response.status).toBe(401)
  })

  it('responds with 408 once the admin is closed', async () => {
    const controller = app.getAdminController()!
    controller.closed = true
    try {
      expect((await fetch(`${url}/admin/books`)).status).toBe(408)
    } finally {
      controller.closed = false
    }
  })
})

describe('AdminController configuration', () => {
  const createAdminApp = (admin: Record<string, any>, env?: string) =>
    createTestApp({
      controllers: { Admin },
      config: { admin, ...(env && { env }) }
    })

  it('defaults to production mode outside of development', async () => {
    const app = createAdminApp({ dist: os.tmpdir() }, 'production')
    const controller = app.getAdminController()!
    expect(controller.mode).toBe('production')
    await app.knex.destroy()
  })

  it('requires `config.admin.root` in development mode', async () => {
    const app = createAdminApp({ mode: 'development' })
    await expect(app.setupControllers()).rejects.toThrow(
      'Controller Admin: Missing `config.admin.root` configuration.'
    )
    await app.knex.destroy()
  })

  it('defines the vite config with the admin url as base', async () => {
    const root = path.join(os.tmpdir(), 'library-admin')
    const app = createAdminApp({ mode: 'production', root, dist: os.tmpdir() })
    const config: any = app.defineAdminViteConfig({ logLevel: 'silent' })
    expect(config).toMatchObject({
      root,
      base: '/admin/',
      mode: 'production',
      logLevel: 'silent',
      build: { outDir: os.tmpdir(), assetsDir: '.' }
    })
    await app.knex.destroy()
  })

  it('injects the `dito` object script into the index html', async () => {
    const root = path.join(os.tmpdir(), 'library-admin')
    const app = createAdminApp({ mode: 'development', root })
    const config: any = app.defineAdminViteConfig({})
    const plugin = config.plugins.find(
      (plugin: any) => plugin.name === 'inject-dito-object'
    )
    const html = plugin.transformIndexHtml.handler(
      '<head>\n  <script type="module" src="/main.js"></script>\n</head>'
    )
    expect(html).toBe(
      '<head>\n  <script src="/admin/dito.js"></script>\n' +
      '  <script type="module" src="/main.js"></script>\n</head>'
    )
    expect(config.build).toEqual({})
    await app.knex.destroy()
  })

  it('splits the production build into chunks', async () => {
    const root = path.join(os.tmpdir(), 'library-admin')
    const app = createAdminApp({ mode: 'production', root, dist: os.tmpdir() })
    const config: any = app.defineAdminViteConfig({})
    const { manualChunks } = config.build.rollupOptions.output
    expect(manualChunks(path.join(root, 'views', 'books.js'))).toBe('views')
    expect(manualChunks(path.join(app.basePath, 'src', 'common.js'))).toBe(
      'common'
    )
    expect(manualChunks('/x/node_modules/vue/index.js')).toBe('core')
    expect(manualChunks('/x/node_modules/@tiptap/core/index.js')).toBe('core')
    expect(manualChunks('/x/node_modules/lodash/index.js')).toBe('vendor')
    expect(manualChunks('\0vite/preload-helper')).toBe('core')
    await app.knex.destroy()
  })
})
