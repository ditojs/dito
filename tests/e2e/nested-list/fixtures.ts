import { defineScenario } from '../../utils/fixture-app.js'
import { Item } from './models/Item.js'
import { Widget } from './models/Widget.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Widget, Item],
  controllers: {
    // Answers load the items, so the admin form shows them after reload.
    Widget: { find: { populate: ['items'] } }
  }
})
