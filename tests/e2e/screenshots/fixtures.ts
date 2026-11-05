import { z } from 'zod'
import { defineScenario } from '../../utils/fixture-app.js'
import { Project } from './models/Project.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Project],
  controllers: {
    Project: {
      filters: {
        status: z.string(),
        search: {
          schema: z.string(),
          where: ({ value }: { value: string }) => ({
            name: { $ilike: `%${value}%` }
          })
        }
      }
    }
  }
})
