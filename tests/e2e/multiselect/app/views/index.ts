import type { Tag } from '../../models/Tag.js'
import type { Widget } from '../../models/Widget.js'
import { createWidgetView } from
  '../../../schema-components/app/views/createWidgetView.js'

export const widgets = createWidgetView<Widget>(
  'Widget',
  'widgets',
  {
    name: { type: 'text', label: 'Name' },
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
