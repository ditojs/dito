import { SchemaGraph } from './SchemaGraph.js'

// A library with shelves of books, where each book can relate to one of the
// library's authors, either through the options of the library's own `authors`
// list (internal relation) or through an external resource (external relation).
const sourceSchema = { type: 'form' }
const shelvesSchema = { type: 'list' }
const booksSchema = { type: 'list' }
const authorsSchema = { type: 'list' }
const internalAuthorSchema = { type: 'select', relate: true }
const externalPublisherSchema = { type: 'select', relate: true }

function createLibraryGraph() {
  const graph = new SchemaGraph()
  // Data paths with indices, as they are passed while processing the data:
  graph.addSource('shelves', shelvesSchema)
  graph.addSource('shelves/0/books', booksSchema)
  graph.addSource('shelves/1/books', booksSchema)
  graph.addRelation('shelves/0/books/0/author', 'authors', internalAuthorSchema)
  graph.setSourceRelated('authors')
  graph.addSource('authors', authorsSchema)
  graph.addRelation(
    'shelves/0/books/0/publisher',
    null,
    externalPublisherSchema
  )
  return graph
}

function createLibraryData() {
  return {
    id: 1,
    authors: [{ id: 10 }, { id: '@1' }],
    shelves: [
      {
        id: 20,
        books: [
          {
            id: 30,
            author: { id: 10 },
            publisher: { id: 40 }
          },
          {
            id: '@2',
            author: { id: '@1' },
            publisher: { id: 41 }
          }
        ]
      },
      { id: '@3', books: [] }
    ]
  }
}

describe('SchemaGraph', () => {
  describe('set()', () => {
    it('merges the settings of the items of lists under wildcards', () => {
      const graph = createLibraryGraph()
      expect(graph.flatten().map(([dataPath]) => dataPath)).toEqual([
        'shelves',
        'shelves/*/books',
        'shelves/*/books/*/author',
        'shelves/*/books/*/publisher',
        'authors'
      ])
    })

    it('merges settings and applies defaults only for unset settings', () => {
      const graph = new SchemaGraph()
      graph.set('books', { a: 1 }, { b: 1, c: 1 })
      graph.set('books', { b: 2 }, { c: 2, d: 2 })
      expect(graph.flatten()).toEqual([['books', { a: 1, b: 2, c: 1, d: 2 }]])
    })

    it('normalizes the data paths', () => {
      const graph = new SchemaGraph()
      graph.set('shelves[0].books', { type: 'source' })
      expect(graph.flatten()).toEqual([
        ['shelves/*/books', { type: 'source' }]
      ])
    })
  })

  describe('addSource()', () => {
    it('adds unrelated sources', () => {
      const graph = new SchemaGraph()
      graph.addSource('books', booksSchema)
      expect(graph.flatten()).toEqual([
        ['books', { type: 'source', schema: booksSchema, related: false }]
      ])
    })

    it('keeps sources related that were marked before they were added', () => {
      const graph = new SchemaGraph()
      graph.setSourceRelated('authors')
      graph.addSource('authors', authorsSchema)
      const [[, settings]] = graph.flatten()
      expect(settings).toMatchObject({ type: 'source', related: true })
      expect(settings.reference).toMatch(/^[\w-]{6}$/)
    })
  })

  describe('addRelation()', () => {
    it('shares the reference prefix with the related source', () => {
      const graph = createLibraryGraph()
      const settings = Object.fromEntries(graph.flatten())
      expect(settings['shelves/*/books/*/author']).toMatchObject({
        type: 'relation',
        internal: true
      })
      expect(settings['shelves/*/books/*/author'].reference).toBe(
        settings.authors.reference
      )
    })

    it('adds external relations without reference', () => {
      const graph = createLibraryGraph()
      const settings = Object.fromEntries(graph.flatten())
      expect(settings['shelves/*/books/*/publisher']).toMatchObject({
        type: 'relation',
        internal: false,
        reference: null
      })
    })
  })

  describe('getReferencePrefix()', () => {
    it('returns the same prefix per data path, and none without', () => {
      const graph = new SchemaGraph()
      const prefix = graph.getReferencePrefix('authors')
      expect(graph.getReferencePrefix('authors')).toBe(prefix)
      expect(graph.getReferencePrefix('editors')).not.toBe(prefix)
      expect(graph.getReferencePrefix(null)).toBe(null)
    })

    it('uses different prefixes in each graph', () => {
      expect(new SchemaGraph().getReferencePrefix('authors')).not.toBe(
        new SchemaGraph().getReferencePrefix('authors')
      )
    })
  })

  describe(`process() for target 'server'`, () => {
    function processForServer() {
      const graph = createLibraryGraph()
      const reference = graph.getReferencePrefix('authors')
      const data = graph.process(sourceSchema, createLibraryData(), {
        target: 'server'
      })
      return { data, reference }
    }

    it('keeps the ids of persisted items and the root item', () => {
      const { data } = processForServer()
      expect(data.id).toBe(1)
      expect(data.authors[0]).toEqual({ id: 10 })
      expect(data.shelves[0].id).toBe(20)
      expect(data.shelves[0].books[0]).toEqual({
        id: 30,
        author: { id: 10 },
        publisher: { id: 40 }
      })
    })

    it(`converts temporary ids of unrelated sources to plain '#id'`, () => {
      const { data } = processForServer()
      expect(data.shelves[1]).toEqual({ '#id': '3', 'books': [] })
      expect(data.shelves[0].books[1]['#id']).toBe('2')
      expect(data.shelves[0].books[1]).not.toHaveProperty('id')
    })

    it(`pairs temporary related items as prefixed '#id' and '#ref'`, () => {
      const { data, reference } = processForServer()
      expect(data.authors[1]).toEqual({ '#id': `${reference}-1` })
      expect(data.shelves[0].books[1].author).toEqual({
        '#ref': `${reference}-1`
      })
    })
  })

  describe(`process() for target 'clipboard'`, () => {
    function processForClipboard() {
      const graph = createLibraryGraph()
      return graph.process(sourceSchema, createLibraryData(), {
        target: 'clipboard'
      })
    }

    it('removes the ids of the root item and of unrelated sources', () => {
      const data = processForClipboard()
      expect(data).not.toHaveProperty('id')
      expect(data.shelves[0]).not.toHaveProperty('id')
      expect(data.shelves[0].books[0]).not.toHaveProperty('id')
    })

    it('removes temporary ids of unrelated sources too', () => {
      const data = processForClipboard()
      expect(data.shelves[1]).not.toHaveProperty('id')
      expect(data.shelves[0].books[1]).not.toHaveProperty('id')
    })

    it('converts the ids of related items and internal relations to `@id`', () => {
      const data = processForClipboard()
      expect(data.authors).toEqual([{ id: '@10' }, { id: '@1' }])
      expect(data.shelves[0].books[0].author).toEqual({ id: '@10' })
      expect(data.shelves[0].books[1].author).toEqual({ id: '@1' })
    })

    it('keeps the ids of external relations', () => {
      const data = processForClipboard()
      expect(data.shelves[0].books[0].publisher).toEqual({ id: 40 })
    })
  })

  describe('process() with custom id keys', () => {
    it('uses `idKey` of sources and `relateBy` of relations', () => {
      const graph = new SchemaGraph()
      graph.addSource('authors', { type: 'list', idKey: 'key' })
      graph.setSourceRelated('authors')
      graph.addRelation('books/0/author', 'authors', {
        type: 'select',
        relateBy: 'key'
      })
      const data = graph.process(
        { type: 'form', idKey: 'key' },
        {
          key: 'library',
          authors: [{ key: 'woolf' }],
          books: [{ id: 1, author: { key: 'woolf' } }]
        },
        { target: 'clipboard' }
      )
      expect(data).toEqual({
        authors: [{ key: '@woolf' }],
        books: [{ id: 1, author: { key: '@woolf' } }]
      })
    })
  })

  describe('process() with missing data', () => {
    it('ignores missing and empty values along the data paths', () => {
      const graph = createLibraryGraph()
      const data = graph.process(
        sourceSchema,
        { id: 1, shelves: [{ books: null }, { id: 2 }] },
        { target: 'server' }
      )
      expect(data).toEqual({ id: 1, shelves: [{ books: null }, { id: 2 }] })
    })

    it('handles relations to multiple items', () => {
      const graph = new SchemaGraph()
      graph.setSourceRelated('authors')
      graph.addSource('authors', authorsSchema)
      graph.addRelation('books/0/authors', 'authors', internalAuthorSchema)
      const reference = graph.getReferencePrefix('authors')
      const data = graph.process(
        sourceSchema,
        {
          authors: [{ id: '@1' }, { id: 2 }],
          books: [{ id: 3, authors: [{ id: '@1' }, { id: 2 }] }]
        },
        { target: 'server' }
      )
      expect(data.books[0].authors).toEqual([
        { '#ref': `${reference}-1` },
        { id: 2 }
      ])
    })
  })
})
