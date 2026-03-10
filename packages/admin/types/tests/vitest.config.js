import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [],
    typecheck: {
      include: ['**/*.test-d.ts'],
      tsconfig: './packages/admin/types/tests/tsconfig.json'
    }
  }
})
