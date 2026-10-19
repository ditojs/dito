import type {
  Components,
  FormSchema,
  ListSchema,
  ViewSchema
} from '@ditojs/admin'
import type { Book, Entry, Shelf } from './models/Book.js'

function createEntries(
  label: string,
  options: Partial<ListSchema<Entry>> = {}
): ListSchema<Entry> {
  return {
    type: 'list',
    label,
    itemLabel: 'title',
    editable: true,
    form: {
      type: 'form',
      label: 'Entry',
      fields: {
        title: { type: 'text', label: 'Entry Title' }
      }
    },
    ...options
  }
}

const bookComponents: Components<Book> = {
  title: { type: 'text', label: 'Title' },
  chapters: createEntries('Chapters'),
  // Routes its forms under its own path instead of its name.
  appendices: createEntries('Appendices', { path: 'extras' }),
  // Nested sections hold the data of their components under their name.
  contents: {
    type: 'section',
    label: 'Contents',
    nested: true,
    fields: { notes: createEntries('Notes') }
  },
  // Sections that aren't nested share the data of the form.
  more: {
    type: 'section',
    label: 'More',
    fields: { quotes: createEntries('Quotes') }
  },
  // Inlined objects hold the data of their components under their name.
  meta: {
    type: 'object',
    label: 'Meta',
    fields: { sources: createEntries('Sources') }
  },
  // A name that doesn't survive normalizing and denormalizing its path,
  // `source-urls`, unchanged.
  sourceURLs: createEntries('Source URLs')
}

// Shared by two views, `books` and `drafts`.
const bookForm: FormSchema<Book> = {
  type: 'form',
  label: 'Book',
  fields: bookComponents
}

function createBooksView(label: string): ViewSchema<Book> {
  return {
    type: 'view',
    label,
    field: {
      type: 'list',
      label,
      itemLabel: 'title',
      resource: { path: 'books' },
      editable: true,
      creatable: true,
      columns: { title: { label: 'Title' } },
      form: bookForm
    }
  }
}

export const books = createBooksView('Books')

export const drafts = createBooksView('Drafts')

// The book's chapters in a tab, so that the book's form is reloaded on the
// form of a chapter without its tab in the URL.
export const tabbedBooks: ViewSchema<Book> = {
  type: 'view',
  label: 'Tabbed Books',
  field: {
    type: 'list',
    label: 'Tabbed Books',
    itemLabel: 'title',
    resource: { path: 'books' },
    editable: true,
    columns: { title: { label: 'Title' } },
    form: {
      type: 'form',
      label: 'Book',
      tabs: {
        main: {
          type: 'tab',
          label: 'Main',
          fields: { title: { type: 'text', label: 'Title' } }
        },
        content: {
          type: 'tab',
          label: 'Content',
          fields: { chapters: createEntries('Chapters') }
        }
      }
    }
  }
}

// A view with several components, whose list edits the books.
export const shelf: ViewSchema<Shelf> = {
  type: 'view',
  label: 'Shelf',
  fields: {
    intro: { type: 'label', label: 'All books' },
    shelfBooks: {
      type: 'list',
      label: 'Shelf Books',
      itemLabel: 'title',
      resource: { path: 'books' },
      editable: true,
      creatable: true,
      columns: { title: { label: 'Title' } },
      form: {
        type: 'form',
        label: 'Book',
        fields: { title: { type: 'text', label: 'Title' } }
      }
    }
  }
}

// A list that edits and creates its books through the linked view `shelf`.
export const featured: ViewSchema<Book> = {
  type: 'view',
  label: 'Featured',
  field: {
    type: 'list',
    label: 'Featured',
    itemLabel: 'title',
    resource: { path: 'books' },
    view: 'shelf',
    editable: true,
    creatable: true,
    columns: { title: { label: 'Title' } }
  }
}
