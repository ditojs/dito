import type { ViewSchema } from '@ditojs/admin'
import type { Book } from './models/Book.js'

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
      title: { label: 'Title', sortable: true, defaultSort: 'asc' },
      author: { label: 'Author', sortable: true },
      year: { label: 'Year', sortable: true },
      pages: { label: 'Pages', sortable: true },
      available: {
        label: 'Available',
        render: ({ value }) => (value ? 'Yes' : 'No')
      }
    },
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
