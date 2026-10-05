import type { Page } from './models/Page.js'
import type { ViewSchema } from '@ditojs/admin'
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

// Like lineto's views of ordered items: The order is stored through a button
// that posts the order of the items to the resource of its own.
export const pageSequence: ViewSchema<Page> = {
  type: 'view',
  label: 'Page Sequence',
  path: 'page-sequence',
  component: {
    type: 'list',
    label: 'Page Sequence',
    itemLabel: 'name',
    resource: { path: 'pages' },
    columns: { name: { label: 'Name' } },
    orderKey: 'order',
    draggable: true,
    buttons: {
      order: {
        type: 'button',
        text: 'Store Sequence',
        resource: {
          path: 'order',
          method: 'post',
          data: ({ item: pages }: { item: Page[] }) =>
            pages.map(({ id, order }) => ({ id, order }))
        },
        events: {
          success: ({ notify }) => {
            notify({ type: 'success', text: 'The sequence was stored.' })
          }
        }
      }
    }
  }
}
