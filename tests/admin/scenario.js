import os from 'node:os'
import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { TOTP } from 'otpauth'
import { enterValue } from '../../packages/admin/src/test/mount.js'
import { AdminController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.ts'
import { createTestDatabase } from '../utils/database.ts'
import { scenario } from '../e2e/passkeys/app.ts'

// Starts the app of the passkeys scenario for the tests of a file, and resets
// its data before each test, which also ends the sessions. Returns the `app`,
// `getUrl()`, as the URL is only known once the app runs, the `authentication`
// features that its admin controller passes to the admin, and helpers that
// prepare the user `ada` through the app's API, with the session cookie that
// the admin uses too.
export function startPasskeysApp() {
  const { models, setup, beforeEach: seed } = scenario
  const app = createTestApp({
    ...scenario,
    controllers: { ...scenario.controllers, admin: AdminController },
    config: {
      ...scenario.config,
      // The tests send wrong passwords and codes on purpose:
      log: { errors: false },
      // Only for the global config, the admin is mounted by the tests:
      admin: { mode: 'production', dist: os.tmpdir(), api: { users: 'users' } }
    }
  })
  let url = null

  beforeAll(async () => {
    await createTestDatabase(app)
    await setup(app)
    await app.start()
    // Passkeys need a secure context, which `localhost` is:
    url = getAppUrl(app).replace('//127.0.0.1:', '//localhost:')
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
  })

  beforeEach(async () => {
    for (const modelClass of Object.values(models).reverse()) {
      await modelClass.query().delete()
    }
    await seed()
  })

  const post = async (path, data = {}) => {
    // Requests from the server's origin keep its session cookie:
    window.happyDOM.setURL(url)
    const response = await fetch(`/users/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.message)
    }
    return result
  }

  return {
    app,
    getUrl: () => url,
    getAuthentication: () =>
      app.getAdminController().getGlobalConfig().authentication,
    post,

    logIn: () => post('login', { username: 'ada', password: 'secret' }),

    // Sets up TOTP for the logged-in user, confirmed with the code of the
    // previous period, so the current one still logs in. Returns the `totp`
    // that generates the codes, and the `backupCodes`:
    async setUpTotp() {
      const { secret } = await post('totp')
      const totp = new TOTP({ secret })
      const code = totp.generate({ timestamp: Date.now() - totp.period * 1000 })
      const { backupCodes } = await post('totp-confirm', { code })
      return { totp, backupCodes }
    }
  }
}

// Generous for slow CI runners, as the code dialogs alone stay a second, see
// `settings.minDuration`:
export const waitOptions = { timeout: 10_000 }

// The dialog on top, as the ones that leave keep their element meanwhile:
export const getDialog = admin =>
  admin.wrapper
    .findAll('.dito-dialog:not(.dito-dialog-leave-active)')
    .at(-1)

// Waits for the dialog with the button `text` on top:
export const waitForDialog = (admin, text) =>
  vi.waitFor(() => {
    const dialog = getDialog(admin)
    expect(dialog?.findAll('button').map(button => button.text())).toContain(
      text
    )
    return dialog
  }, waitOptions)

// Waits for the dialog with the button `text` on top, enters `values` and
// clicks the button:
export async function answerDialog(admin, text, values = {}) {
  const dialog = await waitForDialog(admin, text)
  for (const [name, value] of Object.entries(values)) {
    await enterValue(dialog.find(`input[name="${name}"]`), value)
  }
  await dialog
    .findAll('button')
    .find(button => button.text() === text)
    .trigger('click')
  await flushPromises()
  return dialog
}

export const waitForNotification = (notify, expected) =>
  vi.waitFor(
    () =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining(expected)),
    waitOptions
  )
