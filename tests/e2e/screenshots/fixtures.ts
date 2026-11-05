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
      scopes: {
        $default: {},
        planned: { status: 'Planned' },
        active: { status: 'Active' },
        done: { status: 'Done' }
      },
      filters: {
        status: z.string(),
        search: {
          schema: z.string(),
          where: (search: string) => ({ name: { $ilike: `%${search}%` } })
        }
      }
    }
  }
})
