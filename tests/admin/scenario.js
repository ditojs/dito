import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { TOTP } from 'otpauth'
import { enterValue } from '../../packages/admin/src/test/mount.js'
import { createTestApp, getAppUrl } from '../utils/app.ts'
import { scenario } from '../e2e/passkeys/app.ts'

// Starts the app of the passkeys scenario for the tests of a file, and resets
// its data before each test, which also ends the sessions. Returns `getUrl()`,
// as the URL is only known once the app runs, `em()`, a new fork of the
// entity manager to read and write the data, the `authentication` features
// that the admin gets from the server, and helpers that prepare the user `ada`
// through the app's API, with the session cookie that the admin uses too. The
// tests mount the admin themselves.
export function startPasskeysApp() {
  const { entities, users, seed } = scenario
  let app = null
  let url = null

  beforeAll(async () => {
    // The admin of the tests sends its requests to the root of the server:
    app = await createTestApp({ entities, api: users, prefix: '' })
    // The tests send wrong passwords and codes on purpose:
    app.logErrors = false
    await app.start()
    // Passkeys need a secure context, which `localhost` is:
    url = getAppUrl(app).replace('//127.0.0.1:', '//localhost:')
  })

  afterAll(() => app?.stop())

  beforeEach(async () => {
    await app.orm.schema.clear()
    await seed(app.orm.em.fork())
  })

  const post = async (path, data = {}) => {
    // Requests from the server's origin keep its session cookie:
    window.happyDOM.setURL(url)
    const response = await fetch(`/users/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    // Actions without an answer answer 204:
    const result = response.status === 204 ? null : await response.json()
    if (!response.ok) {
      throw new Error(result.message)
    }
    return result
  }

  return {
    getUrl: () => url,
    em: () => app.orm.em.fork(),
    getAuthentication: () => app.authentication,
    post,

    logIn: () => post('login', { username: 'ada', password: 'secret' }),

    // Sets up TOTP for the logged-in user, confirmed with the code of the
    // previous period, so the current one still logs in. Returns the `totp`
    // that generates the codes, and the `backupCodes`:
    async setUpTotp() {
      const { secret } = await post('totp')
      const totp = new TOTP({ secret })
      const confirm = () =>
        post('totp-confirm', {
          code: totp.generate({ timestamp: Date.now() - totp.period * 1000 })
        })
      // A period that rolls over meanwhile expires the code, so we try again:
      const { backupCodes } = await confirm().catch(confirm)
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
