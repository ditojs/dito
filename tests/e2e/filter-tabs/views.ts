import type { EntityDTO } from '@mikro-orm/core'
import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'

export const widgets = createWidgetView<EntityDTO<Widget>>(
  'Widget',
  'widgets',
  {
    name: { type: 'text', label: 'Name' },
    published: { type: 'switch', label: 'Published' }
  },
  {
    columns: {
      name: { label: 'Name' },
      published: {
        label: 'Published',
        render: ({ item }) => (item.published ? 'Yes' : 'No')
      }
    },
    filterTabs: {
      all: { label: 'All' },
      published: { label: 'Published', filter: { published: true } },
      unpublished: { label: 'Unpublished', filter: { published: false } }
    },
    filters: {
      search: {
        fields: {
          search: { label: 'Search', type: 'text' }
        }
      }
    }
  }
)
