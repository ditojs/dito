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
    columns: { name: { label: 'Name' } },
    form: {
      type: 'form',
      components: {
        name: { type: 'text', label: 'Name' },
        email: { type: 'email', label: 'Email' }
      },
      // A button with the name of a field, which must not take the field's
      // place in the registries of components, e.g. for errors.
      buttons: {
        name: {
          type: 'button',
          text: 'Suggest Name',
          events: {
            click: ({ item }) => {
              item.name = 'Suggested Name'
            }
          }
        }
      }
    }
  }
)
