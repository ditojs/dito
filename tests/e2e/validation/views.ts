import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'

export const widgets = createWidgetView<Widget>(
  'Widget',
  'widgets',
  {
    name: { type: 'text', label: 'Name' },
    email: { type: 'email', label: 'Email' }
  },
  {
    creatable: true,
    columns: { name: { label: 'Name' } }
  }
)
