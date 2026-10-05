import type { Tag } from './models/Tag.js'
import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'

export const widgets = createWidgetView<Widget>(
  'Widget',
  'widgets',
  {
    name: { type: 'text', label: 'Name' },
    size: {
      type: 'multiselect',
      label: 'Size',
      required: true,
      options: ['Small', 'Large']
    },
    tags: {
      type: 'multiselect',
      label: 'Tags',
      multiple: true,
      relate: true,
      clearable: true,
      options: {
        data: ({ request }: { request: (opts: { url: string }) => Promise<Tag[]> }) =>
          request({ url: 'tags' }),
        label: 'name',
        value: 'id'
      }
    }
  },
  {
    creatable: true,
    columns: { name: { label: 'Name' } }
  }
)
