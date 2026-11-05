import { z } from 'zod'
import { defineScenario, db } from '../../utils/fixture-app.js'
import { Widget } from './models/Widget.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Widget],
  controllers: {
    Widget: {
      filters: {
        published: z.stringbool(),
        search: {
          schema: z.string(),
          where: ({ value }: { value: string }) => ({
            name: { $ilike: `%${value}%` }
          })
        }
      }
    }
  },
  beforeEach: async () => {
    await db.insert(Widget, { name: 'Alpha', published: true })
    await db.insert(Widget, { name: 'Beta', published: false })
  }
})
