import type { EntityDTO } from '@mikro-orm/core'
import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'

export const widgets = createWidgetView<EntityDTO<Widget>>(
  'Widget',
  'widgets',
  {
    name: { type: 'text', label: 'Name' },
    items: {
      type: 'list',
      label: 'Items',
      orderKey: 'order',
      inlined: true,
      creatable: true,
      deletable: true,
      draggable: true,
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
