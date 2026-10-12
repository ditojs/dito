import { test as base, expect } from '@playwright/test'

type BrowserErrorReporter = (error: string) => void

/**
 * Playwright test object that fails tests with errors in the browser: uncaught
 * exceptions, and errors that Vue or the admin log, e.g. from watchers.
 */
export const test = base.extend<{ shouldFailOnBrowserErrors: void }>({
  shouldFailOnBrowserErrors: [
    async ({ page }, use) => {
      const browserErrors: string[] = []
      page.on('pageerror', error => {
        browserErrors.push(error.stack ?? error.message)
      })
      await page.exposeFunction(
        'reportBrowserError',
        (error: string) => {
          browserErrors.push(error)
        }
      )
      // Errors are logged as `Error` objects, e.g. by Vue's error handler for
      // errors in watchers and render functions, while messages that tests
      // expect are logged as strings, e.g. notifications, or by the browser
      // itself, e.g. failed requests when the server rejects invalid data.
      // They are told apart in the page when they're logged, as the logged
      // objects can't be inspected anymore once the page navigated away.
      await page.addInitScript(() => {
        const { reportBrowserError } = window as unknown as {
          reportBrowserError: BrowserErrorReporter
        }
        const logError = console.error
        console.error = (...args: unknown[]) => {
          const [firstArgument] = args
          if (firstArgument instanceof Error) {
            reportBrowserError(firstArgument.stack ?? `${firstArgument}`)
          }
          logError.apply(console, args)
        }
      })
      await use()
      expect(browserErrors, 'Errors in the browser').toEqual([])
    },
    { auto: true }
  ]
})
