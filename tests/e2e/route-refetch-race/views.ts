import type { EntityDTO } from '@mikro-orm/core'
import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'

export const widgets = createWidgetView<EntityDTO<Widget>>(
  'Widget',
  'widgets',
  {
    name: { type: 'text', label: 'Name' },
    // The items list has its own `resource`, the Item controller. With a
    // resource attached, the sub-form's Save fires a real PATCH against
    // `/api/widgets/:widgetId/items/:id`, after which the list in the Widget
    // form loads its items again. No `inlined: true`, so each item edit lives
    // on its own route.
    items: {
      type: 'list',
      label: 'Items',
      resource: { path: 'items' },
      creatable: true,
      editable: true,
      form: {
        type: 'form',
        fields: {
          label: { type: 'text', label: 'Label' }
        }
      }
    }
  },
  {
    creatable: true,
    columns: { name: { label: 'Name' } }
  }
)
