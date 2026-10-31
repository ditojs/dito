import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
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
    const admin = serveAdmin({
      base: '/admin/',
      dist,
      api,
      settings: { rootClass: 'lineto' },
      authentication,
      ...options
    })
    return {
      request: (path: string, init?: RequestInit) =>
        admin.fetch(
          new Request(`http://localhost${path}`, init)
        )
    }
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
    expect((await app.request('/administrator')).status).toBe(404)
  })

  it('allows only GET and HEAD', async () => {
    const response = await createApp().request('/admin/', { method: 'POST' })
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')
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
      authorize: (request: Request) => request.headers.get('x-user') === 'admin'
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
  let admin: ReturnType<typeof serveAdmin>

  function request(path: string, init?: RequestInit) {
    return admin.fetch(new Request(`https://admin.test${path}`, init))
  }

  beforeAll(async () => {
    cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-admin-vite-'))
    admin = serveAdmin({
      base: '/admin',
      mode: 'development',
      root,
      api,
      authentication,
      vite: await defineAdminViteConfig(
        { root, base: '/admin', mode: 'development' },
        { cacheDir, logLevel: 'silent' }
      )
    })
  })

  afterAll(async () => {
    await admin.close()
    // Vite's optimizer may still write its cache when it closes.
    await fs.rm(cacheDir, { recursive: true, force: true, maxRetries: 5 })
  })

  it('serves index.html through Vite with dito.js', async () => {
    const response = await request('/admin/')
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<script src="/admin/dito.js"></script>')
    expect(html).toContain('/admin/@vite/client')
  })

  it('answers the routes of the admin with index.html', async () => {
    for (const path of ['/admin', '/admin/fonts/12/edit']) {
      const response = await request(path)
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('/admin/dito.js')
    }
  })

  it('serves the sources through Vite', async () => {
    const response = await request('/admin/index.js')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/javascript/)
    expect(await response.text()).toContain('views/index.js')
  })

  it('sends dito.js itself', async () => {
    const code = await (await request('/admin/dito.js')).text()
    expect(code).toContain('"hasPasskeys": true')
  })

  it('answers other paths with 404', async () => {
    expect((await request('/other')).status).toBe(404)
  })

  it(`serves HMR on Vite's port`, async () => {
    const client = await (await request('/admin/@vite/client')).text()
    const port = client.match(/const hmrPort = (\d+)/)?.[1]
    const token = client.match(/const wsToken = "([^"]+)"/)?.[1]
    expect(port).toBeDefined()
    // The client uses `ws` also on pages served over HTTPS.
    expect(client).toMatch(/const socketProtocol = "ws"/)
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/admin/?token=${token}`,
      ['vite-hmr']
    )
    const message = await new Promise<string>((resolve, reject) => {
      socket.onmessage = event => resolve(String(event.data))
      socket.onerror = reject
    })
    expect(JSON.parse(message)).toMatchObject({ type: 'connected' })
    socket.close()
  })

  it('answers 503 once closed', async () => {
    const other = serveAdmin({
      base: '/admin',
      mode: 'development',
      root,
      vite: { configFile: false, logLevel: 'silent', cacheDir }
    })
    await other.close()
    const response = await other.fetch(new Request('http://localhost/admin/'))
    expect(response.status).toBe(503)
  })

  it('needs root', () => {
    expect(() => serveAdmin({ base: '/admin', mode: 'development' })).toThrow(
      /`root`/
    )
  })
})
