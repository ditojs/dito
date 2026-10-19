import { vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { createServer } from 'vite'
import { Application } from '../app/Application.js'
import { AdminController } from './AdminController.js'

vi.mock('vite', async importOriginal => ({
  ...(await importOriginal()),
  createServer: vi.fn()
}))

class Admin extends AdminController {}

// Development mode resolves `@ditojs/admin` from the root, like an app's:
const root = import.meta.dirname

function createApp({ admin, env } = {}) {
  return new Application({
    config: {
      app: { normalizePaths: true },
      log: { silent: true },
      logger: { prettyPrint: false, level: 'silent' },
      server: { host: '127.0.0.1', port: 0 },
      admin,
      ...(env && { env })
    },
    controllers: { Admin }
  })
}

function mockViteServer() {
  const server = {
    // Connect middleware that only handles one url, like vite's dev server.
    middlewares: (req, res, next) => {
      if (req.url === '/admin/catalog.js') {
        res.end('export default "catalog"')
      } else {
        next()
      }
    },
    close: vi.fn(async () => {})
  }
  createServer.mockResolvedValue(server)
  return server
}

describe('AdminController', () => {
  afterEach(() => {
    createServer.mockReset()
  })

  it('defaults to development mode in development environments', () => {
    const app = createApp({ admin: { root: os.tmpdir() }, env: 'development' })
    expect(app.getAdminController().mode).toBe('development')
  })

  it('serves the vite dev server in development mode', async () => {
    const server = mockViteServer()
    const app = createApp({
      admin: { mode: 'development', root }
    })
    await app.start()
    try {
      const { port } = app.server.address()
      const response = await fetch(
        `http://127.0.0.1:${port}/admin/catalog.js`
      )
      expect(await response.text()).toBe('export default "catalog"')
      const [[config]] = createServer.mock.calls
      expect(config).toMatchObject({
        root,
        base: '/admin/',
        server: {
          middlewareMode: true,
          watch: { ignored: ['!**/node_modules/@ditojs/**'] }
        }
      })
    } finally {
      await app.stop()
    }
    expect(server.close).toHaveBeenCalledTimes(1)
    expect(app.getAdminController().isClosed).toBe(true)
  })

  it(`doesn't close the vite dev server again once closed`, async () => {
    const server = mockViteServer()
    const app = createApp({
      admin: { mode: 'development', root }
    })
    await app.start()
    app.getAdminController().isClosed = true
    await app.stop()
    expect(server.close).not.toHaveBeenCalled()
  })

  it('prefers the admin vite config of the app', async () => {
    mockViteServer()
    const app = createApp({ admin: { mode: 'production', dist: os.tmpdir() } })
    vi.spyOn(app, 'loadAdminViteConfig').mockResolvedValue({
      logLevel: 'silent',
      server: { hmr: { overlay: false } }
    })
    await app.setupControllers()
    await app.getAdminController().setupViteServer()
    const [[config]] = createServer.mock.calls
    expect(config).toEqual({
      logLevel: 'silent',
      server: {
        middlewareMode: true,
        ws: { server: null },
        hmr: { overlay: false }
      }
    })
  })

  it('stops while an HMR client is connected', async () => {
    const { createServer: createViteServer } = await vi.importActual('vite')
    createServer.mockImplementation(createViteServer)
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-admin-'))
    const app = createApp({ admin: { mode: 'development', root } })
    vi.spyOn(app, 'loadAdminViteConfig').mockResolvedValue({
      root,
      base: '/admin/',
      configFile: false,
      logLevel: 'silent'
    })
    try {
      await app.start()
      const { port } = app.server.address()
      const socket = new WebSocket(`ws://127.0.0.1:${port}/admin/`, 'vite-hmr')
      await new Promise((resolve, reject) => {
        socket.onopen = resolve
        socket.onerror = reject
      })
      await app.stop(2000)
    } finally {
      await fs.rm(root, { recursive: true })
    }
  })

  it(`serves HMR through the app's server`, async () => {
    mockViteServer()
    const app = createApp({
      admin: { mode: 'development', root }
    })
    await app.start()
    try {
      const [[config]] = createServer.mock.calls
      expect(config.server.ws.server).toBe(app.server)
    } finally {
      await app.stop()
    }
  })

  describe('with Dito.js packages', () => {
    let dir

    beforeEach(async () => {
      // Vite resolves to real paths, also of the temporary directory:
      dir = await fs.realpath(
        await fs.mkdtemp(path.join(os.tmpdir(), 'dito-packages-'))
      )
    })

    afterEach(async () => {
      await fs.rm(dir, { recursive: true })
    })

    // Write a package with the exports of Dito.js' admin and UI packages:
    async function createPackage(packagePath) {
      await fs.mkdir(path.join(packagePath, 'src'), { recursive: true })
      await fs.mkdir(path.join(packagePath, 'dist'))
      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        JSON.stringify({
          type: 'module',
          exports: {
            '.': { import: './dist/index.js' },
            './style.css': './dist/style.css',
            './src': './src/index.js'
          }
        })
      )
      for (const file of ['src/index.js', 'dist/index.js', 'dist/style.css']) {
        await fs.writeFile(path.join(packagePath, file), '')
      }
      return packagePath
    }

    // Link `node_modules/@ditojs/${name}` inside `from` to the package `to`:
    async function linkPackage(from, name, to) {
      const modulePath = path.join(from, 'node_modules', '@ditojs', name)
      await fs.mkdir(path.dirname(modulePath), { recursive: true })
      await fs.symlink(to, modulePath)
    }

    async function createCheckout() {
      const admin = await createPackage(path.join(dir, 'dito/packages/admin'))
      const ui = await createPackage(path.join(dir, 'dito/packages/ui'))
      await linkPackage(admin, 'ui', ui)
      await linkPackage(path.join(dir, 'app'), 'admin', admin)
      await linkPackage(path.join(dir, 'app'), 'ui', ui)
    }

    // Resolve the imports of the app's admin through its vite config, to the
    // files relative to `dir`, or to 'empty' for empty modules:
    async function resolveImports(mode, ids) {
      const root = path.join(dir, 'app')
      const app = createApp({ admin: { mode, root, dist: root } })
      const { createServer: createViteServer } = await vi.importActual('vite')
      const server = await createViteServer({
        ...(await app.defineAdminViteConfig()),
        logLevel: 'silent',
        server: { middlewareMode: true, ws: false },
        // Resolve the packages themselves, not their optimized dependencies:
        optimizeDeps: { noDiscovery: true }
      })
      const { pluginContainer } = server
      const resolve = async id => {
        const resolved = await pluginContainer.resolveId(
          id,
          path.join(root, 'index.js')
        )
        return (await pluginContainer.load(resolved.id)) === ''
          ? 'empty'
          : path.relative(dir, resolved.id)
      }
      try {
        return Object.fromEntries(
          await Promise.all(ids.map(async id => [id, await resolve(id)]))
        )
      } finally {
        await server.close()
      }
    }

    const ids = [
      '@ditojs/admin',
      '@ditojs/admin/style.css',
      '@ditojs/ui',
      '@ditojs/ui/style.css'
    ]

    it('loads linked packages from their sources in development mode', async () => {
      await createCheckout()
      expect(await resolveImports('development', ids)).toEqual({
        '@ditojs/admin': 'dito/packages/admin/src/index.js',
        '@ditojs/admin/style.css': 'empty',
        '@ditojs/ui': 'dito/packages/ui/src/index.js',
        '@ditojs/ui/style.css': 'empty'
      })
    })

    it('loads linked packages from their builds in production mode', async () => {
      await createCheckout()
      expect(await resolveImports('production', ids)).toEqual({
        '@ditojs/admin': 'dito/packages/admin/dist/index.js',
        '@ditojs/admin/style.css': 'dito/packages/admin/dist/style.css',
        '@ditojs/ui': 'dito/packages/ui/dist/index.js',
        '@ditojs/ui/style.css': 'dito/packages/ui/dist/style.css'
      })
    })

    it('loads installed packages from their builds in development mode', async () => {
      // Installed like pnpm does, linked to its store inside `node_modules`:
      const store = 'app/node_modules/.pnpm/node_modules/@ditojs'
      const admin = await createPackage(path.join(dir, store, 'admin'))
      const ui = await createPackage(path.join(dir, store, 'ui'))
      await linkPackage(path.join(dir, 'app'), 'admin', admin)
      await linkPackage(path.join(dir, 'app'), 'ui', ui)
      expect(await resolveImports('development', ids)).toEqual({
        '@ditojs/admin': `${store}/admin/dist/index.js`,
        '@ditojs/admin/style.css': `${store}/admin/dist/style.css`,
        '@ditojs/ui': `${store}/ui/dist/index.js`,
        '@ditojs/ui/style.css': `${store}/ui/dist/style.css`
      })
    })
  })
})
