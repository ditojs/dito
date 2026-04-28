import type { Widget } from '../../models/Widget.js'
import { createWidgetView } from
  '../../../schema-components/app/views/createWidgetView.js'

export const widgets = createWidgetView<Widget>(
  'Widget',
  'widgets',
  {
    name: { type: 'text', label: 'Name' }
  },
  {
    creatable: true,
    deletable: true,
    columns: { name: { label: 'Name' } }
  }
)
