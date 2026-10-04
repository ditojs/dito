// tests/playwright.config.ts
import { defineConfig } from '@playwright/test'

// Run browser, server and database in the same fixed timezone ahead of UTC,
// as in a typical deployment, so date tests are deterministic and catch values
// shifted by UTC conversion.
const timezone = 'Europe/Zurich'
process.env.TZ = timezone

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    headless: true,
    timezoneId: timezone,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
})
