import { defineConfig } from 'vitest/config'
import createVuePlugin from '@vitejs/plugin-vue'

// The admin's server and Vite config are tested on Node, with the server tests:
const componentTests = [
  'packages/ui/src/**/*.test.*',
  'packages/admin/src/*.test.*',
  'packages/admin/src/!(server|vite)/**/*.test.*'
]
// The admin's tests against servers:
const adminTests = ['tests/admin/**/*.test.*']
const excludedDirectories = [
  '**/node_modules/**',
  '**/e2e/**',
  '.claude/**',
  '.worktrees/**'
]

export default defineConfig({
  test: {
    globals: true,
    // A timezone with daylight saving time, so that tests of dates cross it:
    env: { TZ: 'Europe/Zurich' },
    exclude: excludedDirectories,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          // Server tests create databases on Postgres, which can take several
          // seconds when many test files do so at once:
          testTimeout: 30_000,
          hookTimeout: 30_000,
          exclude: [...excludedDirectories, ...componentTests, ...adminTests]
        }
      },
      {
        extends: true,
        plugins: [createVuePlugin()],
        test: {
          name: 'components',
          include: componentTests,
          environment: 'happy-dom'
        }
      },
      {
        extends: true,
        plugins: [createVuePlugin()],
        test: {
          name: 'admin',
          // Their hooks start apps and drop databases, see above:
          hookTimeout: 30_000,
          include: adminTests,
          environment: './tests/admin/environment.js'
        }
      }
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{js,ts,vue}'],
      exclude: [
        'packages/build/**',
        'packages/*/src/test/**',
        '**/*.test.*',
        '**/*.d.ts'
      ],
      reporter: ['text-summary', 'json-summary', 'html'],
      // Fail when the coverage drops noticeably, see `pnpm coverage` in CI:
      thresholds: { lines: 98, branches: 97 }
    }
  }
})
