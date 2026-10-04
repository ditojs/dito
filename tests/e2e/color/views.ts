import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'

export const widgets = createWidgetView<Widget>(
  'Widget',
  'widgets',
  {
    name: { type: 'text', label: 'Name' },
    color: { type: 'color', label: 'Color', clearable: true },
    alphaColor: { type: 'color', label: 'Alpha Color', alpha: true },
    rgbColor: { type: 'color', label: 'RGB Color', format: 'rgb' },
    hslColor: { type: 'color', label: 'HSL Color', format: 'hsl' },
    nameColor: { type: 'color', label: 'Name Color', format: 'name' }
  },
  {
    creatable: true,
    columns: { name: { label: 'Name' } }
  }
)
