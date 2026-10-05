import type { Page } from './models/Page.js'
import { createWidgetView } from '../../utils/views.js'

export const pages = createWidgetView<Page>('name', 'pages', {
  name: { type: 'text', label: 'Name' },
  // Like lineto's child pages: The list loads its items through its own
  // resource, but is included in the data, to store the order of its items.
  childPages: {
    type: 'list',
    label: 'Child Pages',
    columns: { name: { label: 'Name' } },
    orderKey: 'order',
    draggable: true,
    resource: { path: 'child-pages' },
    exclude: false,
    process: ({ value }) =>
      (value as Page[]).map(({ id, order }) => ({ id, order }))
  }
})
