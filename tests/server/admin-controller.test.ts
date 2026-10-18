import os from 'os'
import path from 'path'
import type { ControllerActions } from '@ditojs/server'
import {
  AdminController,
  CredentialModel,
  PasskeyService,
  SessionModel,
  TotpService,
  UserModel,
  UsersController
} from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'

class Admin extends AdminController {
  override actions: ControllerActions<Admin> = {
    'get info'() {
      return { ok: true }
    }
  }
}

class Session extends SessionModel {}
class Credential extends CredentialModel {}
class Member extends UserModel {}
class Editor extends UserModel {}

function createAdminApp(
  api: Record<string, unknown> = {},
  options: Parameters<typeof createTestApp>[0] = {}
) {
  return createTestApp({
    ...options,
    controllers: { Admin, ...options.controllers },
    config: {
      ...options.config,
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

  it('resolves config paths', async () => {
    const app = createAdminApp()
    try {
      await app.setup()
      const controller = app.getAdminController()!
      expect(controller.resolveConfigPath('dist')).toBe(
        path.resolve(os.tmpdir())
      )
    } finally {
      await app.knex?.destroy()
    }
  })

  it("doesn't modify `config.admin.api`", async () => {
    const api = {}
    const app = createAdminApp(api)
    try {
      await app.setup()
      const controller = app.getAdminController() as Admin
      expect(controller.getGlobalConfig().api).toEqual({ normalizePaths: true })
      expect(api).toEqual({})
    } finally {
      await app.knex?.destroy()
    }
  })

  describe('authentication', () => {
    // The users controllers of the app, which route all actions:
    class Members extends UsersController {
      override modelClass = Member

      override sendPasswordReset() {}
    }

    // The users controller of the admin, which routes neither password resets
    // nor passkeys:
    class Editors extends Members {
      override modelClass = Editor

      override collection: any = {
        allow: ['post login', 'post login-code', 'post logout', 'get session']
      }
    }

    // Get the `authentication` of the admin that logs in through `users`, in an
    // app with the passkey and TOTP services and password resets:
    const getAuthentication = async (
      users: string,
      {
        services = { passkeys: PasskeyService, totp: TotpService },
        config = { passkeys: true, totp: { secret: 'totp-secret' } }
      }: Record<string, any> = {}
    ) => {
      const app = createAdminApp(
        { url: '/api/', users },
        {
          config: {
            app: {
              name: 'Example',
              normalizePaths: true,
              keys: ['test-secret'],
              session: { modelClass: 'Session' },
              authentication: {
                credentials: { modelClass: 'Credential' },
                passwordReset: {
                  confirmUrl: 'https://example.com/#password-reset={token}'
                }
              }
            },
            services: config
          },
          services,
          models: { Session, Credential, Member, Editor },
          controllers: { api: { Members, Editors } }
        }
      )
      try {
        await app.setup()
        return app.getAdminController()!.getGlobalConfig().authentication
      } finally {
        await app.knex?.destroy()
      }
    }

    it('passes no features without a users controller', async () => {
      expect(await getAuthentication('authors')).toEqual({
        passkeys: false,
        totp: false,
        passwordReset: false
      })
    })

    it('passes the features of the users controller at `api.users`', async () => {
      expect(await getAuthentication('members')).toEqual({
        passkeys: true,
        totp: true,
        passwordReset: true
      })
    })

    it(`passes only the features that the admin's controller routes`, async () => {
      expect(await getAuthentication('/editors')).toEqual({
        passkeys: false,
        totp: true,
        passwordReset: false
      })
    })

    it('passes no features of services configured as `false`', async () => {
      expect(
        await getAuthentication('members', {
          config: { passkeys: false, totp: false }
        })
      ).toEqual({ passkeys: false, totp: false, passwordReset: true })
    })

    it('passes the features of subclasses of the services', async () => {
      class Passkeys extends PasskeyService {}
      expect(
        await getAuthentication('members', {
          services: { passkeys: Passkeys },
          config: { passkeys: true }
        })
      ).toEqual({ passkeys: true, totp: false, passwordReset: true })
    })
  })
})
