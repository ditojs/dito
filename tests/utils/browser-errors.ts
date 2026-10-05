import { test as base, expect, type ConsoleMessage } from '@playwright/test'

// Errors are logged as `Error` objects, e.g. by Vue's error handler for errors
// in watchers and render functions, while messages that tests expect are
// logged as strings, e.g. notifications, or by the browser itself, e.g. failed
// requests when the server rejects invalid data.
async function isErrorObjectLogged(message: ConsoleMessage) {
  const [firstArgument] = message.args()
  return firstArgument
    ? await firstArgument
        .evaluate(value => value instanceof Error)
        .catch(() => false)
    : false
}

/**
 * Playwright test object that fails tests with errors in the browser: uncaught
 * exceptions, and errors that Vue or the admin log, e.g. from watchers.
 */
export const test = base.extend<{ shouldFailOnBrowserErrors: void }>({
  shouldFailOnBrowserErrors: [
    async ({ page }, use) => {
      const browserErrors: string[] = []
      const pendingChecks: Promise<void>[] = []
      page.on('pageerror', error => {
        browserErrors.push(error.stack ?? error.message)
      })
      page.on('console', message => {
        if (message.type() === 'error') {
          pendingChecks.push(
            isErrorObjectLogged(message).then(isError => {
              if (isError) {
                browserErrors.push(message.text())
              }
            })
          )
        }
      })
      await use()
      await Promise.all(pendingChecks)
      expect(browserErrors, 'Errors in the browser').toEqual([])
    },
    { auto: true }
  ]
})
