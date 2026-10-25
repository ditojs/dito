import { defineConfig } from 'vitest/config'
import createVuePlugin from '@vitejs/plugin-vue'

const componentTests = [
  'packages/{admin,ui}/src/**/*.test.*',
  // The admin's tests against servers:
  'tests/admin/**/*.test.*'
]
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
          // Server tests start in-memory databases with pglite, which can take
          // several seconds when many test files do so at once:
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // NOTE: The V8 of Node.js 24 sometimes frees wasm code twice when
          // collecting pglite's dead wasm code, and crashes the worker:
          // https://github.com/nodejs/node/issues/66366
          execArgv: ['--no-wasm-code-gc'],
          exclude: [...excludedDirectories, ...componentTests]
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
      }
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{js,ts,vue}'],
      exclude: ['packages/build/**', '**/*.test.*', '**/*.d.ts'],
      reporter: ['text-summary', 'json-summary', 'html'],
      // Fail when the coverage drops noticeably, see `pnpm coverage` in CI:
      thresholds: { lines: 98, branches: 97 }
    }
  }
})
