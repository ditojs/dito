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
    Widget: { find: { populate: ['items'] } },
    // The items of a widget, as a resource nested under it, so that
    // GET/PATCH /api/widgets/:widgetId/items/:id work. The nesting of the
    // routes lets the watcher of SourceMixin, `from.path.startsWith(to.path)`,
    // reload the list when cancelling back from an item form.
    Item: {
      path: 'widgets/:widgetId/items',
      find: c => ({ where: { widget: Number(c.req.param('widgetId')) } }),
      deserialize: (c, json) => ({
        ...(json as object),
        widget: Number(c.req.param('widgetId'))
      })
    }
  }
})
