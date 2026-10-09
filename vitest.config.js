import { defineConfig } from 'vitest/config'
import createVuePlugin from '@vitejs/plugin-vue'

const componentPackages = 'packages/{admin,ui}/src/**'
const excludedDirectories = [
  '**/node_modules/**',
  '**/e2e/**',
  '.claude/**',
  '.worktrees/**'
]

export default defineConfig({
  test: {
    globals: true,
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
          exclude: [...excludedDirectories, `${componentPackages}/*.test.*`]
        }
      },
      {
        extends: true,
        plugins: [createVuePlugin()],
        test: {
          name: 'components',
          include: [`${componentPackages}/*.test.*`],
          environment: 'happy-dom'
        }
      }
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{js,ts,vue}'],
      exclude: ['packages/build/**', '**/*.test.*', '**/*.d.ts'],
      reporter: ['text-summary', 'json-summary', 'html']
    }
  }
})
