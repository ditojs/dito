import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { defineAdminViteConfig, serveAdmin } from '../src/index.ts'

const api = { url: '/api/admin/', users: { path: 'admins' } }
const authentication = {
  hasPasskeys: true,
  hasTotp: false,
  hasPasswordChange: true,
  hasPasswordReset: false
}

describe('serveAdmin() in production', () => {
  let dist: string

  beforeAll(async () => {
    dist = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-admin-dist-'))
    await fs.writeFile(
      path.join(dist, 'index.html'),
      '<script src="/admin/dito.js"></script>'
    )
    await fs.writeFile(path.join(dist, 'core-Ab12_x-Z.js'), 'export {}')
    await fs.writeFile(path.join(dist, 'views-Cd34_y-W.js'), 'export {}')
    await fs.writeFile(path.join(dist, 'favicon.svg'), '<svg></svg>')
  })

  afterAll(() => fs.rm(dist, { recursive: true }))

  function createApp(options = {}) {
    const app = new Hono()
    app.route(
      '/',
      serveAdmin({
        base: '/admin/',
        dist,
        api,
        settings: { rootClass: 'lineto' },
        authentication,
        ...options
      }).app
    )
    return app
  }

  it('serves the built files', async () => {
    const response = await createApp().request('/admin/core-Ab12_x-Z.js')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^text\/javascript/)
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable'
    )
    expect(await response.text()).toBe('export {}')
  })

  it('checks files without a hash again on each load', async () => {
    const response = await createApp().request('/admin/favicon.svg')
    expect(response.headers.get('content-type')).toMatch(/^image\/svg\+xml/)
    expect(response.headers.get('cache-control')).toBe('no-cache')
  })

  it('answers the routes of the admin with index.html', async () => {
    const app = createApp()
    for (const url of ['/admin', '/admin/', '/admin/fonts/12/edit']) {
      const response = await app.request(url)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toMatch(/^text\/html/)
      expect(response.headers.get('cache-control')).toBe('no-cache')
      expect(await response.text()).toContain('/admin/dito.js')
    }
  })

  it('answers missing files with 404', async () => {
    const app = createApp()
    expect((await app.request('/admin/missing.js')).status).toBe(404)
    expect((await app.request('/admin/%2e%2e/secret.js')).status).toBe(404)
    expect((await app.request('/other')).status).toBe(404)
  })

  it('answers HEAD requests without a body', async () => {
    const response = await createApp().request('/admin/core-Ab12_x-Z.js', {
      method: 'HEAD'
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe('9')
    expect(await response.text()).toBe('')
  })

  it('sends the dito object as dito.js', async () => {
    const response = await createApp().request('/admin/dito.js')
    expect(response.headers.get('content-type')).toMatch(/^text\/javascript/)
    const code = await response.text()
    expect(code).toMatch(/^window\.dito = /)
    expect(JSON.parse(code.replace(/^window\.dito = /, ''))).toEqual({
      base: '/admin',
      api,
      settings: { rootClass: 'lineto' },
      authentication
    })
  })

  it('sends no authentication features by default', async () => {
    const app = createApp({ authentication: undefined })
    const code = await (await app.request('/admin/dito.js')).text()
    expect(JSON.parse(code.replace(/^window\.dito = /, ''))).toMatchObject({
      authentication: {
        hasPasskeys: false,
        hasTotp: false,
        hasPasswordChange: false,
        hasPasswordReset: false
      }
    })
  })

  it('authorizes the views', async () => {
    const app = createApp({
      authorize: (c: { req: { header: (name: string) => unknown } }) => (
        c.req.header('x-user') === 'admin'
      )
    })
    expect((await app.request('/admin/views-Cd34_y-W.js')).status).toBe(401)
    const response = await app.request('/admin/views-Cd34_y-W.js', {
      headers: { 'x-user': 'admin' }
    })
    expect(response.status).toBe(200)
    expect((await app.request('/admin/core-Ab12_x-Z.js')).status).toBe(200)
  })

  it('needs dist', () => {
    expect(() => serveAdmin({ base: '/admin' })).toThrow(/`dist`/)
  })
})

describe('serveAdmin() in development', () => {
  const root = path.join(import.meta.dirname, 'fixture')
  let cacheDir: string
  let server: Server
  let close: () => Promise<void>
  let url: string

  beforeAll(async () => {
    cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-admin-vite-'))
    const app = new Hono()
    server = serve({
      fetch: app.fetch,
      port: 0,
      hostname: '127.0.0.1'
    }) as Server
    const admin = serveAdmin({
      base: '/admin',
      mode: 'development',
      root,
      api,
      authentication,
      server,
      vite: await defineAdminViteConfig(
        { root, base: '/admin', mode: 'development' },
        { cacheDir, logLevel: 'silent' }
      )
    })
    close = admin.close
    app.route('/', admin.app)
    app.notFound(c => c.text('app', 404))
    if (!server.listening) {
      await new Promise(resolve => server.once('listening', resolve))
    }
    const { port } = server.address() as AddressInfo
    url = `http://127.0.0.1:${port}`
  })

  afterAll(async () => {
    await close()
    await new Promise(resolve => server.close(resolve))
    // Vite's optimizer may still write its cache when it closes.
    await fs.rm(cacheDir, { recursive: true, force: true, maxRetries: 5 })
  })

  it('serves index.html through Vite with dito.js', async () => {
    const response = await fetch(`${url}/admin/`)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<script src="/admin/dito.js"></script>')
    expect(html).toContain('/admin/@vite/client')
  })

  it('answers the routes of the admin with index.html', async () => {
    for (const path of ['/admin', '/admin/fonts/12/edit']) {
      const response = await fetch(`${url}${path}`)
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('/admin/dito.js')
    }
  })

  it('serves the sources through Vite', async () => {
    const response = await fetch(`${url}/admin/index.js`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/javascript/)
    expect(await response.text()).toContain('views/index.js')
  })

  it('sends dito.js itself', async () => {
    const code = await (await fetch(`${url}/admin/dito.js`)).text()
    expect(code).toContain('"hasPasskeys": true')
  })

  it('leaves other paths to the app', async () => {
    const response = await fetch(`${url}/other`)
    expect(await response.text()).toBe('app')
  })

  it(`serves HMR through the app's server`, async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${new URL(url).port}/admin/`, [
      'vite-hmr'
    ])
    const message = await new Promise<string>((resolve, reject) => {
      socket.onmessage = event => resolve(String(event.data))
      socket.onerror = reject
    })
    expect(JSON.parse(message)).toMatchObject({ type: 'connected' })
    socket.close()
  })

  it('needs @hono/node-server', async () => {
    const admin = serveAdmin({
      base: '/admin',
      mode: 'development',
      root,
      vite: {
        configFile: false,
        logLevel: 'silent',
        cacheDir,
        server: { ws: false }
      }
    })
    const app = new Hono()
    app.route('/', admin.app)
    app.onError((error, c) => c.text(error.message, 500))
    const response = await app.request('/admin/')
    expect(await response.text()).toMatch(/@hono\/node-server/)
    await admin.close()
  })

  it('needs root', () => {
    expect(() => serveAdmin({ base: '/admin', mode: 'development' })).toThrow(
      /`root`/
    )
  })
})
