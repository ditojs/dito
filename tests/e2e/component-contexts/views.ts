import type { DitoContext } from '@ditojs/admin'
import type { Book } from './models/Book.js'
import { createWidgetView } from '../../utils/views.js'

// Every field's `if` records a description of the context it is evaluated
// with, per field, so the tests can check that all places that evaluate it
// (panes, containers, type components, the data model) see the same context.

declare global {
  interface Window {
    recordedContexts?: Record<string, string[]>
  }
}

// Describes items by their markers, or as JSON for items without markers,
// e.g. the objects that wrap primitive values.
function describeItem(item?: { marker?: string } | null) {
  return item?.marker ?? JSON.stringify(item)
}

function describeContext(context: DitoContext) {
  const { dataPath, item, parentItem, rootItem } = context
  return [
    dataPath,
    `item: ${describeItem(item)}`,
    `parentItem: ${describeItem(parentItem)}`,
    `rootItem: ${describeItem(rootItem)}`
  ].join(', ')
}

function recordContext(field: string) {
  return (context: DitoContext) => {
    const recordedContexts = (window.recordedContexts ??= {})
    const descriptions = (recordedContexts[field] ??= [])
    const description = describeContext(context)
    if (!descriptions.includes(description)) {
      descriptions.push(description)
    }
    return true
  }
}

const text = (label: string, field: string) => ({
  type: 'text' as const,
  label,
  if: recordContext(field)
})

// `publishing` and `links` are a section and a panel that don't hold values of
// their own.
export const books = createWidgetView<
  Book & { publishing: never; links: never }
>(
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
            title: text('Title', 'title'),
            publishing: {
              type: 'section',
              label: 'Publishing',
              components: {
                subtitle: text('Subtitle', 'subtitle')
              }
            },
            // A panel component, displayed in the sidebar, sharing the data.
            links: {
              type: 'panel',
              label: 'Links',
              components: {
                website: text('Website', 'website')
              }
            },
            meta: {
              type: 'section',
              label: 'Meta',
              nested: true,
              components: {
                note: text('Note', 'meta.note')
              }
            },
            tags: {
              type: 'list',
              label: 'Tags',
              inlined: true,
              form: {
                type: 'form',
                components: { name: text('Name', 'tags.name') }
              }
            },
            chapters: {
              type: 'list',
              label: 'Chapters',
              itemLabel: 'title',
              editable: true,
              form: {
                type: 'form',
                components: { title: text('Title', 'chapters.title') }
              }
            },
            notes: {
              type: 'list',
              label: 'Notes',
              itemLabel: 'text',
              editable: true,
              mutate: true,
              form: {
                type: 'form',
                components: { text: text('Text', 'notes.text') }
              }
            },
            prices: {
              type: 'list',
              label: 'Prices',
              inlined: true,
              wrapPrimitives: 'price',
              form: {
                type: 'form',
                components: {
                  price: {
                    type: 'number',
                    label: 'Price',
                    if: recordContext('prices.price')
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
            edition: text('Edition', 'edition')
          }
        }
      },
      panels: {
        info: {
          type: 'panel',
          label: 'Info',
          components: {
            isbn: text('ISBN', 'isbn')
          }
        }
      }
    }
  }
)
