import type { Widget } from '../../models/Widget.js'
import { createWidgetView } from
  '../../../schema-components/app/views/createWidgetView.js'

export const widgets = createWidgetView<Widget>(
  'Widget',
  'widgets',
  {
    name: { type: 'text', label: 'Name' },
    published: { type: 'switch', label: 'Published' }
  },
  {
    columns: {
      name: { label: 'Name' },
      published: { label: 'Published', render: ({ item }) => item.published ? 'Yes' : 'No' }
    },
    scopes: {
      $default: { label: 'All' },
      published: { label: 'Published' },
      unpublished: { label: 'Unpublished' }
    },
    filters: {
      search: {
        components: {
          search: { label: 'Search', type: 'text' }
        }
      }
    }
  }
)
