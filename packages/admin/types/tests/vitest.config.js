import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [],
    typecheck: {
      include: [
        'packages/admin/types/tests/**/*.test-d.ts'
      ],
      tsconfig: './packages/admin/types/tests/tsconfig.json'
    }
  }
})
