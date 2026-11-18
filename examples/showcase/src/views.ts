import type { ViewSchema } from '@ditojs/admin'
import { html } from '@ditojs/utils'
import type { Book } from './data.js'

export const books: ViewSchema<Book> = {
  type: 'view',
  field: {
    type: 'list',
    itemLabel: 'title',
    resource: { path: 'books' },
    creatable: true,
    editable: true,
    deletable: true,
    paginate: 10,
    columns: {
      title: {
        label: 'Title',
        sortable: true,
        defaultSort: 'asc',
        pinned: 'start',
        resizable: true,
        width: 260
      },
      author: {
        label: 'Author',
        sortable: true,
        resizable: true,
        draggable: true,
        hideable: true
      },
      year: { label: 'Year', sortable: true, draggable: true, hideable: true },
      pages: { label: 'Pages', sortable: true, draggable: true, hidden: true },
      available: {
        label: 'Available',
        draggable: true,
        hideable: true,
        render: ({ value }) => (value ? 'Yes' : 'No')
      }
    },
    preview: ({ item }) =>
      html`<b>${item.title}</b> by ${item.author}, ${item.year}, ${item.pages}
        pages: ${item.chapters?.map(({ title }) => title).join(', ')}`,
    scopes: {
      $default: { label: 'All' },
      available: { label: 'Available' },
      lent: { label: 'Lent' }
    },
    filters: {
      search: {
        fields: {
          search: { label: 'Search', type: 'text' }
        }
      }
    },
    form: {
      type: 'form',
      fields: {
        title: { type: 'text', label: 'Title' },
        author: { type: 'text', label: 'Author' },
        year: { type: 'integer', label: 'Year' },
        pages: { type: 'integer', label: 'Pages' },
        available: { type: 'switch', label: 'Available' },
        chapters: {
          type: 'list',
          label: 'Chapters',
          itemLabel: 'title',
          orderKey: 'order',
          inlined: true,
          collapsible: 'all',
          collapsed: true,
          creatable: true,
          deletable: true,
          draggable: true,
          form: {
            type: 'form',
            fields: {
              title: { type: 'text', label: 'Title' },
              summary: { type: 'textarea', label: 'Summary' }
            }
          }
        }
      }
    }
  }
}
