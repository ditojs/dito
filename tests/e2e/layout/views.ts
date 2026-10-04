import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'

export const widgets = createWidgetView<Widget>(
  'Widget',
  'widgets',
  {},
  {
    creatable: true,
    columns: { name: { label: 'Name' } },
    form: {
      type: 'form',
      tabs: {
        main: {
          type: 'tab',
          label: 'Main',
          defaultTab: true,
          components: {
            name: { type: 'text', label: 'Name' }
          }
        },
        details: {
          type: 'tab',
          label: 'Details',
          components: {
            notes: { type: 'textarea', label: 'Notes' },
            settings: {
              type: 'section',
              label: 'Settings',
              nested: true,
              components: {
                color: { type: 'text', label: 'Color' }
              }
            }
          }
        }
      },
      panels: {
        info: {
          type: 'panel',
          label: 'Info',
          components: {
            size: {
              type: 'select',
              label: 'Size',
              options: ['Small', 'Large']
            }
          }
        }
      }
    }
  }
)
