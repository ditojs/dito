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
      admin: { mode: 'development', root: os.tmpdir() }
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
        root: os.tmpdir(),
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
      admin: { mode: 'development', root: os.tmpdir() }
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
      admin: { mode: 'development', root: os.tmpdir() }
    })
    await app.start()
    try {
      const [[config]] = createServer.mock.calls
      expect(config.server.ws.server).toBe(app.server)
    } finally {
      await app.stop()
    }
  })
})
