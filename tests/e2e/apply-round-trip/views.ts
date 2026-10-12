import type { Author, Book } from './models/Book.js'
import { createWidgetView } from '../../utils/views.js'

const authors: Author[] = [
  { id: 1, name: 'Jane' },
  { id: 2, name: 'Tom' }
]

export const books = createWidgetView<Book>(
  'Book',
  'books',
  {
    title: { type: 'text', label: 'Title' },
    // The chapters are edited in nested forms, which apply their changes to
    // the book's data, saved with the book.
    chapters: {
      type: 'list',
      label: 'Chapters',
      itemLabel: 'title',
      editable: true,
      columns: {
        title: { label: 'Chapter' },
        // Shown in the list, but not in the chapter's form, so not stored.
        wordCount: { label: 'Words' },
        author: {
          label: 'Author',
          render: ({ value }) => value?.name ?? ''
        }
      },
      form: {
        type: 'form',
        label: 'Chapter',
        components: {
          title: { type: 'text', label: 'Chapter Title' },
          // Stored with its prefix, which `serializeValue()` adds when saving.
          code: {
            type: 'text',
            label: 'Code',
            serializeValue: ({ value }) => (value ? `ch-${value}` : value)
          },
          // Edited in the form, but not stored on the server.
          note: { type: 'text', label: 'Note', exclude: true },
          // Not edited, but stored with the chapter.
          pageCount: { type: 'hidden' },
          // Related objects are stored as references, but displayed with
          // their data, e.g. in the list's column.
          author: {
            type: 'select',
            label: 'Author',
            relate: true,
            options: { data: authors, label: 'name', value: 'id' }
          }
        }
      }
    },
    // Volumes and their parts are edited in the forms of a tree, which apply
    // their changes to the book's data like the chapters.
    volumes: {
      type: 'tree-list',
      label: 'Volumes',
      itemLabel: 'title',
      editable: true,
      form: {
        type: 'form',
        label: 'Volume',
        components: {
          title: { type: 'text', label: 'Volume Title' }
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
  },
  { columns: { title: { label: 'Title' } } }
)
