// tests/playwright.config.ts
import { defineConfig } from '@playwright/test'

// Run browser, server and database in the same fixed timezone ahead of UTC,
// as in a typical deployment, so date tests are deterministic and catch values
// shifted by UTC conversion.
const timezone = 'Europe/Zurich'
process.env.TZ = timezone

// The screenshot tests run in the browser of the Playwright Docker image, so
// that they render the same everywhere: `scripts/screenshots.js` starts
// it and passes its endpoint, see `pnpm -C tests screenshots`.
const screenshotsEndpoint = process.env.SCREENSHOTS_WS_ENDPOINT
const screenshotFiles = /\.screenshot\.ts$/

// Actions and expectations wait for their conditions as long as the test may
// take, so that tests don't fail on busy machines:
const timeout = 60_000

export default defineConfig({
  testDir: './e2e',
  timeout,
  expect: { timeout },
  retries: process.env.CI ? 1 : 0,
  snapshotPathTemplate: '{testDir}/{testFileDir}/__screenshots__/{arg}{ext}',
  use: {
    headless: true,
    timezoneId: timezone,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'e2e',
      testIgnore: screenshotFiles
    },
    ...(
      screenshotsEndpoint
        ? [
            {
              name: 'screenshots',
              testMatch: screenshotFiles,
              use: {
                viewport: { width: 1600, height: 1000 },
                deviceScaleFactor: 1,
                connectOptions: {
                  wsEndpoint: screenshotsEndpoint,
                  // Let the browser in the container reach the test servers on
                  // the host's loopback interface.
                  exposeNetwork: '<loopback>'
                }
              }
            }
          ]
        : []
    )
  ]
})
