import { vi } from 'vitest'
import os from 'os'
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
      server: { port: 0 },
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
        `http://localhost:${port}/admin/catalog.js`
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
    expect(app.getAdminController().closed).toBe(true)
  })

  it(`doesn't close the vite dev server again once closed`, async () => {
    const server = mockViteServer()
    const app = createApp({
      admin: { mode: 'development', root: os.tmpdir() }
    })
    await app.start()
    app.getAdminController().closed = true
    await app.stop()
    expect(server.close).not.toHaveBeenCalled()
  })

  it('prefers the admin vite config of the app', async () => {
    mockViteServer()
    const app = createApp({ admin: { mode: 'production', dist: os.tmpdir() } })
    vi.spyOn(app, 'loadAdminViteConfig').mockResolvedValue({
      logLevel: 'silent',
      server: { hmr: { port: 0 } }
    })
    await app.setupControllers()
    await app.getAdminController().setupViteServer()
    const [[config]] = createServer.mock.calls
    expect(config).toEqual({
      logLevel: 'silent',
      server: {
        middlewareMode: true,
        hmr: { port: expect.any(Number) }
      }
    })
    // Port 0 is replaced with a random free port.
    expect(config.server.hmr.port).toBeGreaterThan(0)
  })
})
