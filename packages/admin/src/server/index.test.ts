import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { Hono, type Context, type Next } from 'hono'
import { createAdaptorServer } from '@hono/node-server'
import type { User } from '@ditojs/server'
import { createAdmin, type AdminServer } from './index.ts'

// Routes the admin at `/admin` of a host app, as apps do.
function route(admin: AdminServer) {
  const app = new Hono()
  app.route('/admin', admin)
  return (path: string, init?: RequestInit) =>
    app.fetch(new Request(`http://localhost${path}`, init))
}

const api = { url: '/api/admin/', users: { path: 'admins' } }
const authentication = {
  hasPasskeys: true,
  hasTotp: false,
  hasPasswordChange: true,
  hasPasswordReset: false
}

describe('createAdmin() in production', () => {
  let dist: string

  beforeAll(async () => {
    dist = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-admin-dist-'))
    await fs.writeFile(
      path.join(dist, 'index.html'),
      '<script src="/admin/dito.js"></script>'
    )
    await fs.mkdir(path.join(dist, 'assets'))
    await fs.mkdir(path.join(dist, 'views'))
    await fs.writeFile(path.join(dist, 'assets/core-Ab12_x-Z.js'), 'export {}')
    await fs.writeFile(path.join(dist, 'views/views-Cd34_y-W.js'), 'export {}')
    await fs.writeFile(path.join(dist, 'favicon.svg'), '<svg></svg>')
  })

  afterAll(() => fs.rm(dist, { recursive: true }))

  function setupAdmin(options = {}) {
    const admin = createAdmin({
      base: '/admin/',
      dist,
      api,
      settings: { rootClass: 'app' },
      authentication,
      ...options
    })
    return { request: route(admin) }
  }

  it('throws without a build to serve', () => {
    expect(() => createAdmin({ base: '/admin' })).toThrow(
      'Unable to serve the admin without `vite` or `dist`'
    )
    const missing = path.join(dist, 'missing')
    expect(() => createAdmin({ base: '/admin', dist: missing })).toThrow(
      `Unable to find the admin's build in '${missing}'`
    )
  })

  it('serves the built files', async () => {
    const response = await setupAdmin().request(
      '/admin/assets/core-Ab12_x-Z.js'
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^text\/javascript/)
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable'
    )
    expect(await response.text()).toBe('export {}')
  })

  it('checks files outside of the build folders again on each load', async () => {
    const response = await setupAdmin().request('/admin/favicon.svg')
    expect(response.headers.get('content-type')).toMatch(/^image\/svg\+xml/)
    expect(response.headers.get('cache-control')).toBe('no-cache')
  })

  it('answers the routes of the admin with index.html', async () => {
    const admin = setupAdmin()
    for (const url of [
      '/admin',
      '/admin/',
      '/admin/fonts/12/edit',
      '/admin/assets/12'
    ]) {
      const response = await admin.request(url)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toMatch(/^text\/html/)
      expect(response.headers.get('cache-control')).toBe('no-cache')
      expect(await response.text()).toContain('/admin/dito.js')
    }
  })

  it('answers missing files with 404', async () => {
    const admin = setupAdmin()
    expect((await admin.request('/admin/missing.js')).status).toBe(404)
    expect((await admin.request('/admin/%2e%2e/secret.js')).status).toBe(404)
    expect((await admin.request('/other')).status).toBe(404)
    expect((await admin.request('/administrator')).status).toBe(404)
  })

  it('answers other methods than GET and HEAD with 404', async () => {
    const response = await setupAdmin().request('/admin/', { method: 'POST' })
    expect(response.status).toBe(404)
  })

  it('answers HEAD requests without a body', async () => {
    const response = await setupAdmin().request(
      '/admin/assets/core-Ab12_x-Z.js',
      {
        method: 'HEAD'
      }
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe('9')
    expect(await response.text()).toBe('')
  })

  it('sends the dito object as dito.js', async () => {
    const response = await setupAdmin().request('/admin/dito.js')
    expect(response.headers.get('content-type')).toMatch(/^text\/javascript/)
    const code = await response.text()
    expect(code).toMatch(/^window\.dito = /)
    expect(JSON.parse(code.replace(/^window\.dito = /, ''))).toEqual({
      base: '/admin',
      api,
      settings: { rootClass: 'app' },
      authentication
    })
  })

  it('sends no authentication features by default', async () => {
    const admin = setupAdmin({ authentication: undefined })
    const code = await (await admin.request('/admin/dito.js')).text()
    expect(JSON.parse(code.replace(/^window\.dito = /, ''))).toMatchObject({
      authentication: {
        hasPasskeys: false,
        hasTotp: false,
        hasPasswordChange: false,
        hasPasswordReset: false
      }
    })
  })

  it('authorizes the views with a function', async () => {
    const admin = setupAdmin({
      authorize: ({ c }: { c: Context }) => c.req.header('x-user') === 'admin'
    })
    expect((await admin.request('/admin/views/views-Cd34_y-W.js')).status).toBe(
      401
    )
    const response = await admin.request('/admin/views/views-Cd34_y-W.js', {
      headers: { 'x-user': 'admin' }
    })
    expect(response.status).toBe(200)
    expect((await admin.request('/admin/assets/core-Ab12_x-Z.js')).status).toBe(
      200
    )
  })

  it('grants access only when the function returns `true`', async () => {
    const admin = setupAdmin({ authorize: () => 'yes' })
    const response = await admin.request('/admin/views/views-Cd34_y-W.js')
    expect(response.status).toBe(401)
  })

  it('protects the views in any case', async () => {
    const admin = setupAdmin({ authorize: () => false })
    for (const folder of ['VIEWS', 'Views', encodeURI('viewſ')]) {
      const response = await admin.request(
        `/admin/${folder}/views-Cd34_y-W.js`
      )
      expect(response.status).toBe(404)
    }
  })

  it('authorizes the views by the roles of the user', async () => {
    const admin = setupAdmin({
      // Sets the role that `getUser` reads, as a session middleware would.
      middleware: async (c: Context, next: Next) => {
        c.set('role' as never, c.req.header('x-role') as never)
        await next()
      },
      getUser: ({ c }: { c: Context }) => {
        const role = c.get('role' as never) as string | undefined
        return role ? { roles: [role] } : null
      },
      authorize: ['admin', 'editor']
    })
    const request = (role?: string) =>
      admin.request('/admin/views/views-Cd34_y-W.js', {
        headers: role ? { 'x-role': role } : {}
      })
    expect((await request()).status).toBe(401)
    expect((await request('customer')).status).toBe(403)
    expect((await request('editor')).status).toBe(200)
    expect((await admin.request('/admin/assets/core-Ab12_x-Z.js')).status).toBe(
      200
    )
  })

  it('runs the middleware only on the requests it authorizes', async () => {
    const paths: string[] = []
    const admin = setupAdmin({
      middleware: async (c: Context, next: Next) => {
        paths.push(c.req.path)
        await next()
      },
      authorize: () => true
    })
    await admin.request('/admin/')
    await admin.request('/admin/dito.js')
    await admin.request('/admin/assets/core-Ab12_x-Z.js')
    await admin.request('/admin/views/views-Cd34_y-W.js')
    expect(paths).toEqual(['/admin/views/views-Cd34_y-W.js'])
  })

  it('gives a function of `authorize` the user', async () => {
    const admin = setupAdmin({
      getUser: () => ({ roles: ['admin'] }),
      authorize: ({ user }: { user: User | null }) =>
        !!user?.roles.includes('admin')
    })
    expect((await admin.request('/admin/views/views-Cd34_y-W.js')).status).toBe(
      200
    )
  })
})

describe('createAdmin() in development', () => {
  let admin: AdminServer
  let server: ReturnType<typeof createAdaptorServer>
  let origin: string

  // Vite runs in middleware mode, so the requests go through a Node server.
  const request = (path: string) => fetch(`${origin}${path}`)

  beforeAll(async () => {
    admin = createAdmin({
      base: '/admin',
      api,
      authentication,
      authorize: 'admin',
      vite: path.join(import.meta.dirname, '../test/admin.vite.config.ts')
    })
    const app = new Hono()
    app.route('/admin', admin)
    server = createAdaptorServer({ fetch: app.fetch })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve))
    await admin.close()
    // Vite's optimizer may still write its cache when it closes.
    await fs.rm(path.join(os.tmpdir(), `dito-admin-vite-${process.pid}`), {
      recursive: true,
      force: true,
      maxRetries: 5
    })
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

  it('authorizes the sources of the views', async () => {
    expect((await request('/admin/views/index.js')).status).toBe(401)
    expect((await request('/admin/shared.js')).status).toBe(200)
  })

  it(`serves HMR on a port of its own`, async () => {
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
})
