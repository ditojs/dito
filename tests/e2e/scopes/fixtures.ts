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
        all: { schema: z.stringbool(), where: () => undefined },
        published: z.stringbool(),
        unpublished: {
          schema: z.stringbool(),
          where: () => ({ published: false })
        },
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
