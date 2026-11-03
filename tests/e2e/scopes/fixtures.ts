import { z } from 'zod'
import { defineScenario, db } from '../../utils/fixture-app.js'
import { Widget } from './models/Widget.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

// The admin's list scopes send `?scope=name`.
const scopes: Record<string, object> = {
  published: { published: true },
  unpublished: { published: false }
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Widget],
  controllers: {
    Widget: {
      find: c => ({ where: scopes[c.req.query('scope') ?? ''] ?? {} }),
      filters: {
        search: {
          schema: z.string(),
          where: (search: string) => ({ name: { $ilike: `%${search}%` } })
        }
      }
    }
  },
  beforeEach: async () => {
    await db.insert(Widget, { name: 'Alpha', published: true })
    await db.insert(Widget, { name: 'Beta', published: false })
  }
})
