import { z } from 'zod'
import { defineScenario } from '../../utils/fixture-app.js'
import { Project } from './models/Project.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

// The admin's list scopes send `?scope=name`.
const scopes: Record<string, object> = {
  planned: { status: 'Planned' },
  active: { status: 'Active' },
  done: { status: 'Done' }
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Project],
  controllers: {
    Project: {
      find: c => ({ where: scopes[c.req.query('scope') ?? ''] ?? {} }),
      filters: {
        search: {
          schema: z.string(),
          where: (search: string) => ({ name: { $ilike: `%${search}%` } })
        }
      }
    }
  }
})
