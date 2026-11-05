import { z } from 'zod'
import { defineScenario } from '../../utils/fixture-app.js'
import { Project } from './models/Project.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

// The filter of a scope, which `scope=name` applies.
const statusFilter = (status?: string) => ({
  schema: z.stringbool(),
  where: () => (status ? { status } : undefined)
})

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Project],
  controllers: {
    Project: {
      filters: {
        all: statusFilter(),
        planned: statusFilter('Planned'),
        active: statusFilter('Active'),
        done: statusFilter('Done'),
        search: {
          schema: z.string(),
          where: (search: string) => ({ name: { $ilike: `%${search}%` } })
        }
      }
    }
  }
})
