import { defineScenario, db } from '../../utils/fixture-app.js'
import { Tag } from './models/Tag.js'
import { Widget } from './models/Widget.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Widget, Tag],
  controllers: {
    // Answers load the tags, so the admin form shows them after reload.
    // Bodies write `tags: [...]` as links by id.
    Widget: { find: { populate: ['tags'] } }
  },
  beforeEach: async () => {
    const em = db.em()
    for (const name of ['tag-1', 'tag-2', 'tag-3']) {
      em.create(Tag, { name })
    }
    await em.flush()
  }
})
