import { defineScenario, ScenarioController } from '../../utils/fixture-app.js'
import { Tag } from './models/Tag.js'
import { Widget } from './models/Widget.js'

export { expect } from '@playwright/test'

class Widgets extends ScenarioController {
  override modelClass = Widget
  // `^withTags` forces the model's `withTags` scope on every query so GETs
  // re-hydrate the relation. `graph = true` switches PATCH/POST to the
  // graph variants so `tags: [...]` in the body writes through to the
  // WidgetTag join table.
  override scope = ['^withTags']
  override graph = true
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Widget, Tag },
  controllers: { Widgets },
  tables: ['WidgetTag'],
  // Dito's `buildThrough` derives the join table as `${fromName}${toName}`
  // (declaration order, not alphabetical): `Widget.tags` → `WidgetTag`.
  setup: async app => {
    await app.knex.schema.createTable('WidgetTag', table => {
      table.increments('id').primary()
      table.integer('widgetId').unsigned().references('id').inTable('Widget')
      table.integer('tagId').unsigned().references('id').inTable('Tag')
    })
  },
  beforeEach: async () => {
    await Tag.query().insert([
      { name: 'tag-1' },
      { name: 'tag-2' },
      { name: 'tag-3' }
    ])
  }
})
