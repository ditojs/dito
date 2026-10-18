import { execFile } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
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
      settings: { theme: 'dark' },
      authentication: { passkeys: false, totp: false, passwordReset: false }
    })
  })

  it('authorizes access to the admin views', async () => {
    const response = await fetch(`${url}/admin/views/books`)
    expect(response.status).toBe(401)
  })

  it('serves the built SPA without loading the build tools', async () => {
    // Serve it from a process of its own, as vitest itself loads vite, and
    // record which packages the server's imports resolve:
    const script = `
      import { registerHooks } from 'module'
      const specifiers = new Set()
      registerHooks({
        resolve(specifier, context, nextResolve) {
          specifiers.add(specifier)
          return nextResolve(specifier, context)
        }
      })
      const { Application, AdminController } = await import('@ditojs/server')
      class Admin extends AdminController {}
      const app = new Application({
        config: {
          app: { normalizePaths: true },
          log: { silent: true },
          server: { host: '127.0.0.1', port: 0 },
          admin: { mode: 'production', dist: ${JSON.stringify(dist)} }
        },
        controllers: { Admin }
      })
      await app.start()
      const { port } = app.server.address()
      const response = await fetch(\`http://127.0.0.1:\${port}/admin\`)
      const html = await response.text()
      await app.stop()
      console.log(JSON.stringify({ html, specifiers: [...specifiers] }))
    `
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { cwd: import.meta.dirname }
    )
    const { html, specifiers } = JSON.parse(stdout)
    expect(html).toBe('<title>Library</title>')
    expect(specifiers).toContain('koa-static')
    expect(specifiers).not.toContain('vite')
    expect(specifiers).not.toContain('@vitejs/plugin-vue')
    expect(specifiers).not.toContain('@ditojs/build')
  })

  it('responds with 408 once the admin is closed', async () => {
    const controller = app.getAdminController()!
    controller.isClosed = true
    try {
      expect((await fetch(`${url}/admin/books`)).status).toBe(408)
    } finally {
      controller.isClosed = false
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
    const config: any = await app.defineAdminViteConfig({ logLevel: 'silent' })
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
    const config: any = await app.defineAdminViteConfig({})
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
    const config: any = await app.defineAdminViteConfig({})
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
