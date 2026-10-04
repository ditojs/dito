import type { Book } from './models/Book.js'
import { createWidgetView } from '../../utils/views.js'

const title = { type: 'text', label: 'Title' } as const

export const books = createWidgetView<Book>(
  'Book',
  'books',
  {},
  {
    columns: { title: { label: 'Title' } },
    form: {
      type: 'form',
      tabs: {
        main: {
          type: 'tab',
          label: 'Main',
          defaultTab: true,
          components: {
            title,
            meta: {
              type: 'section',
              label: 'Meta',
              nested: true,
              collapsible: true,
              collapsed: true,
              components: {
                note: { type: 'text', label: 'Note' }
              }
            },
            tags: {
              type: 'list',
              label: 'Tags',
              inlined: true,
              creatable: true,
              deletable: true,
              form: {
                type: 'form',
                label: 'Tag',
                components: { name: { type: 'text', label: 'Name' } }
              }
            },
            chapters: {
              type: 'list',
              label: 'Chapters',
              itemLabel: 'title',
              creatable: true,
              editable: true,
              deletable: true,
              form: {
                type: 'form',
                label: 'Chapter',
                components: {
                  title,
                  // Only required in the admin, not on the server.
                  summary: { type: 'text', label: 'Summary', required: true },
                  sections: {
                    type: 'list',
                    label: 'Sections',
                    inlined: true,
                    creatable: true,
                    deletable: true,
                    form: {
                      type: 'form',
                      label: 'Section',
                      components: { title }
                    }
                  }
                }
              }
            }
          }
        },
        details: {
          type: 'tab',
          label: 'Details',
          components: {
            subtitle: { type: 'text', label: 'Subtitle' },
            // Only required in the admin, not on the server.
            edition: { type: 'text', label: 'Edition', required: true }
          }
        }
      }
    }
  }
)
