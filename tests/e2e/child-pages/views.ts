import type { Page } from './models/Page.js'
import type { ViewSchema } from '@ditojs/admin'
import { createWidgetView } from '../../utils/views.js'

export const pages = createWidgetView<Page>('name', 'pages', {
  name: { type: 'text', label: 'Name' },
  // The list loads its items through its own resource, but is included in the
  // data, to store the order of its items.
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

// The order of the items is stored through a button that posts it to a
// resource of its own.
export const pageOrder: ViewSchema<Page> = {
  type: 'view',
  label: 'Page Order',
  path: 'page-order',
  component: {
    type: 'list',
    label: 'Page Order',
    itemLabel: 'name',
    resource: { path: 'pages' },
    columns: { name: { label: 'Name' } },
    orderKey: 'order',
    draggable: true,
    buttons: {
      order: {
        type: 'button',
        text: 'Save Order',
        resource: {
          path: 'order',
          method: 'post',
          data: ({ item: pages }: { item: Page[] }) =>
            pages.map(({ id, order }) => ({ id, order }))
        },
        events: {
          success: ({ notify }) => {
            notify({ type: 'success', text: 'The order was saved.' })
          }
        }
      }
    }
  }
}
