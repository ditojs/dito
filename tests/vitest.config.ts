import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    dir: 'types',
    include: ['**/*.test-d.ts'],
    typecheck: {
      only: true
    }
  }
})
