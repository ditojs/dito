import type { Widget } from '../../models/Widget.js'
import { createWidgetView } from
  '../../../schema-components/app/views/createWidgetView.js'

export const widgets = createWidgetView<Widget>(
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
        components: {
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
