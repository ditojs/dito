import os from 'os'
import path from 'path'
import type { ControllerActions } from '@ditojs/server'
import { AdminController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'

class Admin extends AdminController {
  override actions: ControllerActions<Admin> = {
    'get info'() {
      return { ok: true }
    }
  }
}

function createAdminApp(api: Record<string, unknown> = {}) {
  return createTestApp({
    controllers: { Admin },
    config: {
      admin: {
        mode: 'production',
        dist: os.tmpdir(),
        api
      }
    }
  })
}

describe('AdminController', () => {
  it('routes actions', async () => {
    const app = createAdminApp()
    await app.start()
    try {
      const resp = await fetch(`${getAppUrl(app)}/admin/info`)
      expect(resp.status).toBe(200)
      expect(await resp.json()).toEqual({ ok: true })
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })

  it('resolves config paths, also through deprecated `getPath()`', async () => {
    const app = createAdminApp()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await app.setup()
      const controller = app.getAdminController()!
      expect(controller.resolveConfigPath('dist')).toBe(
        path.resolve(os.tmpdir())
      )
      expect(controller.getPath('dist')).toBe(path.resolve(os.tmpdir()))
    } finally {
      warn.mockRestore()
      await app.knex?.destroy()
    }
  })

  it("doesn't modify `config.admin.api`", async () => {
    const api = {}
    const app = createAdminApp(api)
    try {
      await app.setup()
      const controller = app.getAdminController() as Admin
      expect(controller.getDitoObject().api).toEqual({ normalizePaths: true })
      expect(api).toEqual({})
    } finally {
      await app.knex?.destroy()
    }
  })
})
