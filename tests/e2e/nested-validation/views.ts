import type { Book } from './models/Book.js'
import { createWidgetView } from '../../utils/views.js'

const title = { type: 'text', label: 'Title' } as const

// Unnested sections don't hold data of their own, so their keys are `never`.
type BookItem = Book & { publishing: never }

export const books = createWidgetView<BookItem>(
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
            // Its components are created from the data, e.g. like fields that
            // depend on a selected template.
            credits: {
              type: 'section',
              label: 'Credits',
              nested: true,
              collapsible: true,
              collapsed: true,
              components: ({ item }) =>
                item.edition
                  ? {
                      // Only required in the admin, not on the server.
                      editor: { type: 'text', label: 'Editor', required: true }
                    }
                  : {}
            },
            tags: {
              type: 'list',
              label: 'Tags',
              inlined: true,
              // A create button with its own text.
              creatable: { label: 'Tag the Book' },
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
            },
            // Items and their children are edited in the forms of a tree.
            volumes: {
              type: 'tree-list',
              label: 'Volumes',
              itemLabel: 'title',
              editable: true,
              form: {
                type: 'form',
                label: 'Volume',
                components: {
                  title: { type: 'text', label: 'Volume Title', required: true }
                }
              },
              children: {
                name: 'parts',
                itemLabel: 'title',
                editable: true,
                form: {
                  type: 'form',
                  label: 'Part',
                  components: {
                    title: { type: 'text', label: 'Part Title' }
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
            // Placed before `edition`, so that its error tooltip doesn't
            // cover the button.
            fillEdition: {
              type: 'button',
              text: 'Fill Edition',
              events: {
                click: ({ item }) => {
                  item.edition = 'First'
                }
              }
            },
            // Only required in the admin, not on the server.
            edition: { type: 'text', label: 'Edition', required: true },
            // Unnested, so `publisher` is stored on the book itself, and the
            // section doesn't appear in the data path of its errors.
            publishing: {
              type: 'section',
              label: 'Publishing',
              collapsible: true,
              collapsed: true,
              components: {
                // Only required in the admin, not on the server.
                publisher: { type: 'text', label: 'Publisher', required: true }
              }
            }
          }
        }
      }
    }
  }
)

const summary = { type: 'text', label: 'Summary', required: true } as const

// Two lists edit the same chapters in two tabs, with different forms: Only
// the one in the Content tab displays `title`. Their items are collapsed, so
// errors need to reveal them.
const chapters = {
  type: 'list',
  label: 'Chapters',
  inlined: true,
  collapsible: true,
  collapsed: true
} as const

export const bookOutlines = createWidgetView<BookItem>(
  'Book',
  'books',
  {},
  {
    columns: { title: { label: 'Title' } },
    form: {
      type: 'form',
      tabs: {
        outline: {
          type: 'tab',
          label: 'Outline',
          components: {
            chapters: {
              ...chapters,
              form: {
                type: 'form',
                label: 'Chapter',
                components: { summary }
              }
            }
          }
        },
        // Processed after the Outline tab, so its form decides the processed
        // data of the chapters, which includes `title`.
        content: {
          type: 'tab',
          label: 'Content',
          components: {
            chapters: {
              ...chapters,
              form: {
                type: 'form',
                label: 'Chapter',
                components: { title, summary }
              }
            }
          }
        }
      }
    }
  }
)
