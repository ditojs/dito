// Register the actual type components, for their `serializeValue()`:
import '../types/index.js'
import { fromClipboard } from './fromClipboard.ts'
import { serializeData } from './schema/data.js'

const text = { type: 'text' }

const createForm = (components: Record<string, any>) => ({
  type: 'form',
  components
})

const relateAuthors = (options: Record<string, any> = {}) => ({
  type: 'select',
  relate: true,
  // From the items of the books list, see `optionsTraits.serializeValue()`:
  options: { dataPath: '../../../authors', label: 'name' },
  ...options
})

const library = createForm({
  name: text,
  authors: { type: 'list', form: createForm({ name: text }) },
  books: {
    type: 'list',
    orderKey: 'position',
    forms: {
      novel: createForm({
        title: text,
        author: relateAuthors(),
        coAuthors: relateAuthors({ type: 'multiselect', multiple: true }),
        publisher: {
          type: 'select',
          relate: true,
          options: { data: [{ id: 30, name: 'Hogarth Press' }] }
        },
        chapters: {
          type: 'list',
          orderKey: 'position',
          form: createForm({ title: text })
        }
      }),
      poetry: createForm({
        title: text,
        lines: {
          type: 'list',
          wrapPrimitives: 'line',
          form: createForm({ line: text })
        }
      })
    }
  },
  address: { type: 'object', form: createForm({ city: text }) },
  genres: { type: 'checkboxes', options: ['Novel', 'Poetry'] }
})

const createLibrary = () => ({
  id: 1,
  name: 'Bloomsbury',
  authors: [
    { id: 10, name: 'Virginia Woolf' },
    // A new author, related before saving:
    { id: '@100', name: 'Vita Sackville-West' }
  ],
  books: [
    {
      id: 20,
      type: 'novel',
      position: 0,
      title: 'Orlando',
      author: { id: 10 },
      coAuthors: [{ id: 10 }, { id: '@100' }],
      publisher: { id: 30 },
      chapters: [
        { id: 40, position: 0, title: 'One' },
        { id: '@3', position: 1, title: 'Two' }
      ]
    },
    {
      id: 21,
      type: 'poetry',
      position: 1,
      title: 'The Land',
      lines: ['Winter', 'Spring']
    }
  ],
  address: { id: 50, city: 'London' },
  genres: ['Novel']
})

function copy(schema: Record<string, any>, data: Record<string, any>) {
  return serializeData(schema, { type: 'list' }, data, '', {
    services: null,
    target: 'clipboard'
  })
}

describe('fromClipboard()', () => {
  it('turns copied data back into the data of new items', () => {
    const clipboardData = copy(library, createLibrary())
    const data = fromClipboard(library, clipboardData)
    const [woolf, sackvilleWest] = data.authors
    const authorIds = [woolf.id, sackvilleWest.id]
    expect(authorIds).toEqual([
      expect.stringMatching(/^@\d+$/),
      expect.stringMatching(/^@\d+$/)
    ])
    // New temporary ids, not the ones of the clipboard:
    expect(new Set(authorIds).size).toBe(2)
    expect(authorIds).not.toContain(clipboardData.authors[0].id)
    expect(authorIds).not.toContain(clipboardData.authors[1].id)
    expect(data).toEqual({
      name: 'Bloomsbury',
      authors: [
        { id: woolf.id, name: 'Virginia Woolf' },
        { id: sackvilleWest.id, name: 'Vita Sackville-West' }
      ],
      books: [
        {
          type: 'novel',
          position: 0,
          title: 'Orlando',
          author: { id: woolf.id },
          coAuthors: [{ id: woolf.id }, { id: sackvilleWest.id }],
          // Relations to items outside the copied data keep their ids:
          publisher: { id: 30 },
          chapters: [
            { position: 0, title: 'One' },
            { position: 1, title: 'Two' }
          ]
        },
        {
          type: 'poetry',
          position: 1,
          title: 'The Land',
          lines: ['Winter', 'Spring']
        }
      ],
      address: { city: 'London' },
      genres: ['Novel']
    })
  })

  it('creates new temporary ids each time the data is pasted', () => {
    const clipboardData = copy(library, createLibrary())
    const first = fromClipboard(library, clipboardData)
    const second = fromClipboard(library, clipboardData)
    expect(first.authors[0].id).not.toBe(second.authors[0].id)
    expect(second.books[0].author.id).toBe(second.authors[0].id)
  })

  it('keeps copied items with the same persisted and temporary id apart', () => {
    const schema = createForm({
      authors: { type: 'list', form: createForm({ name: text }) },
      books: {
        type: 'list',
        form: createForm({ author: relateAuthors() })
      }
    })
    const clipboardData = copy(schema, {
      authors: [
        { id: 7, name: 'Virginia Woolf' },
        { id: '@7', name: 'Vita Sackville-West' }
      ],
      books: [{ author: { id: 7 } }, { author: { id: '@7' } }]
    })
    const { authors, books } = fromClipboard(schema, clipboardData)
    expect(authors[0].id).not.toBe(authors[1].id)
    expect(books[0].author.id).toBe(authors[0].id)
    expect(books[1].author.id).toBe(authors[1].id)
  })

  it('leaves out sources with their own resource', () => {
    const schema = createForm({
      name: text,
      authors: {
        type: 'list',
        resource: 'authors',
        form: createForm({ name: text })
      }
    })
    const data = fromClipboard(schema, {
      name: 'Bloomsbury',
      authors: [{ name: 'Virginia Woolf' }]
    })
    expect(data).toEqual({ name: 'Bloomsbury' })
  })

  it(`doesn't change the clipboard data`, () => {
    const clipboardData = copy(library, createLibrary())
    const json = JSON.stringify(clipboardData)
    const data = fromClipboard(library, clipboardData)
    expect(JSON.stringify(clipboardData)).toBe(json)
    expect(data.authors).not.toBe(clipboardData.authors)
  })

  it('deserializes the values of the clipboard data like loaded data', () => {
    // The conversions that serializing can't invert stay, like in loaded data:
    const schema = createForm({
      name: { type: 'text', trim: true },
      notes: { type: 'text', exclude: true },
      openedOn: { type: 'date' },
      publisher: {
        type: 'select',
        relate: true,
        options: { data: [{ id: 30, name: 'Hogarth Press' }] }
      },
      editor: { type: 'select', relate: true, options: { data: [] } }
    })
    const clipboardData = copy(schema, {
      name: ' Bloomsbury ',
      notes: 'Excluded',
      openedOn: new Date(1925, 4, 14),
      publisher: { id: 30, name: 'Hogarth Press' },
      editor: null
    })
    expect(fromClipboard(schema, clipboardData)).toEqual({
      name: 'Bloomsbury',
      openedOn: new Date(1925, 4, 14),
      publisher: { id: 30 },
      editor: null
    })
  })

  it('uses `idKey` of sources and the key in `relate` of relations', () => {
    const schema = createForm({
      authors: {
        type: 'list',
        idKey: 'key',
        form: createForm({ name: text })
      },
      books: {
        type: 'list',
        form: createForm({ author: relateAuthors({ relate: 'key' }) })
      }
    })
    // As `SchemaGraph` copies them, see its tests:
    const data = fromClipboard(schema, {
      authors: [{ key: '@woolf', name: 'Virginia Woolf' }],
      books: [{ author: { key: '@woolf' } }]
    })
    expect(data.authors[0].key).toMatch(/^@\d+$/)
    expect(data.books[0].author.key).toBe(data.authors[0].key)
  })

  it('passes the data path and root data to the callbacks of the schema', () => {
    // Pasted into the second book of a library with the authors as columns:
    const rootData = { hasColumns: true, books: [{}, {}] }
    const schema = createForm({
      details: {
        type: 'section',
        components: ({ rootItem, dataPath }: Record<string, any>) =>
          rootItem.hasColumns && dataPath === 'books/1'
            ? { authors: { type: 'list', columns: { name: {} } } }
            : {}
      }
    })
    const data = fromClipboard(
      schema,
      { authors: [{ id: '@woolf', name: 'Virginia Woolf' }] },
      { dataPath: 'books/1', rootData }
    )
    expect(data.authors[0].id).toMatch(/^@\d+$/)
  })
})
