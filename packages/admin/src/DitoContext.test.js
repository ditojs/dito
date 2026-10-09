import { vi } from 'vitest'
import { reactive } from 'vue'
import DitoContext from './DitoContext.js'
import { registerTypeComponent } from './utils/schema/types.js'

// Register minimal type options, as the actual type components can't be
// imported without a Vue SFC compiler:
registerTypeComponent('text', { defaultNested: true })
registerTypeComponent('section', { defaultNested: false })

describe('DitoContext', () => {
  describe('value', () => {
    it('reads the value of nested components from the root data', () => {
      const rootData = { items: [{ title: 'Book' }] }
      const context = new DitoContext(null, {
        rootData,
        dataPath: 'items/0/title'
      })
      expect(context.value).toBe('Book')
    })

    it('reads the values of components, also while they are `undefined`', () => {
      // E.g. a computed value that the data model hasn't written yet, which is
      // not read through the data path.
      const component = { value: undefined }
      const rootData = { items: [{ status: 'Stale' }] }
      const context = new DitoContext(component, {
        rootData,
        dataPath: 'items/0/status'
      })
      expect(context.value).toBe(undefined)
      component.value = 'Published'
      expect(context.value).toBe('Published')
    })

    it('is `undefined` for values missing in the root data', () => {
      // E.g. computed values that the data model hasn't written yet.
      const rootData = { items: [{}] }
      const context = new DitoContext(null, {
        rootData,
        dataPath: 'items/0/status'
      })
      expect(context.value).toBe(undefined)
    })
  })

  // A library with authors and their books, as the root data of a form:
  const createLibrary = () => ({
    name: 'City Library',
    authors: [
      {
        name: 'Ann',
        books: [
          { title: 'First', tags: ['new'] },
          { title: 'Second', tags: [] }
        ]
      }
    ]
  })

  describe('items', () => {
    it('derives the item and parent item from the data path', () => {
      const rootData = createLibrary()
      const context = new DitoContext(null, {
        rootData,
        dataPath: 'authors/0/books/1/title'
      })
      const [author] = rootData.authors
      expect(context.rootItem).toBe(rootData)
      expect(context.item).toBe(author.books[1])
      // The parent item skips the arrays that hold the items:
      expect(context.parentItem).toBe(author)
      expect(context.value).toBe('Second')
    })

    it('uses the item itself for data paths of items, if not nested', () => {
      const rootData = createLibrary()
      const context = new DitoContext(null, {
        rootData,
        dataPath: 'authors/0/books/1',
        nested: false
      })
      expect(context.item).toBe(rootData.authors[0].books[1])
      expect(context.parentItem).toBe(rootData.authors[0])
      expect(context.value).toBe(undefined)
    })

    it('has no parent item at the root', () => {
      const rootData = createLibrary()
      const context = new DitoContext(null, { rootData, dataPath: 'name' })
      expect(context.item).toBe(rootData)
      expect(context.parentItem).toBe(null)
      expect(context.parentItemDataPath).toBe(null)
      expect(context.parentItemIndex).toBe(null)
    })

    it('prefers the provided data over the data path for the item', () => {
      // E.g. items that are being created, which aren't in the root data yet:
      const rootData = createLibrary()
      const data = { title: 'Draft' }
      const context = new DitoContext(null, {
        rootData,
        data,
        dataPath: 'authors/0/books/2/title'
      })
      expect(context.item).toBe(data)
      expect(context.parentItem).toBe(rootData.authors[0])
    })

    // E.g. for removed items or ones that are being created:
    it('are `null` for data paths missing in the root data', () => {
      const context = new DitoContext(null, {
        rootData: { authors: [] },
        dataPath: 'authors/3/books/0/title'
      })
      expect(context.item).toBe(null)
      expect(context.parentItem).toBe(null)
    })

    it('are `null` without root data', () => {
      const context = new DitoContext(null, { dataPath: '' })
      expect(context.rootItem).toBe(null)
      expect(context.item).toBe(null)
      expect(context.parentItem).toBe(null)
    })

    it('provides the processed and clipboard items when given', () => {
      const processedData = { title: 'Processed' }
      const processedRootData = { authors: [] }
      const clipboardData = { title: 'Copied' }
      const context = new DitoContext(null, {
        processedData,
        processedRootData,
        clipboardData
      })
      expect(context.processedItem).toBe(processedData)
      expect(context.processedRootItem).toBe(processedRootData)
      expect(context.clipboardItem).toBe(clipboardData)
      const empty = new DitoContext(null, {})
      expect(empty.processedItem).toBe(null)
      expect(empty.processedRootItem).toBe(null)
      expect(empty.clipboardItem).toBe(null)
    })
  })

  describe('data paths', () => {
    it('derives names, indices and the data paths of items', () => {
      const context = new DitoContext(null, {
        rootData: createLibrary(),
        dataPath: 'authors/0/books/1/title'
      })
      expect(context.dataPath).toBe('authors/0/books/1/title')
      expect(context.name).toBe('title')
      expect(context.index).toBe(null)
      expect(context.itemDataPath).toBe('authors/0/books/1')
      expect(context.itemIndex).toBe(1)
      expect(context.parentItemDataPath).toBe('authors/0')
      expect(context.parentItemIndex).toBe(0)
    })

    it('derives the index of data paths of list items', () => {
      const context = new DitoContext(null, {
        dataPath: 'authors/0/books/1',
        nested: false
      })
      expect(context.name).toBe(null)
      expect(context.index).toBe(1)
      expect(context.itemIndex).toBe(1)
      expect(context.parentItemIndex).toBe(0)
    })

    it('prefers the provided name and index', () => {
      const context = new DitoContext(null, {
        dataPath: 'authors/0',
        name: 'author',
        index: 5
      })
      expect(context.name).toBe('author')
      expect(context.index).toBe(5)
    })

    it('defaults to an empty data path, nested and without a schema', () => {
      const context = new DitoContext(null, {})
      expect(context.dataPath).toBe('')
      expect(context.nested).toBe(true)
      expect(context.schema).toBe(null)
    })
  })

  describe('component', () => {
    // A stand-in for the component that the context is created for:
    const createComponent = () => ({
      schema: { type: 'text' },
      user: { name: 'Librarian' },
      api: { locale: 'en-US' },
      views: { books: {} },
      flattenedViews: { books: {} },
      itemLabel: 'Book',
      formLabel: 'Books',
      formComponent: { name: 'DitoForm' },
      $route: { query: { page: '2' } },
      request: vi.fn(async options => ({ options })),
      format: vi.fn((value, options) => `${value} ${options.unit}`),
      navigate: vi.fn(),
      download: vi.fn(),
      getResourceUrl: vi.fn(resource => `/api/${resource.path}`),
      notify: vi.fn()
    })

    it('falls back to the values of the component', () => {
      const component = createComponent()
      const context = new DitoContext(component, { dataPath: 'title' })
      expect(context.component).toBe(component)
      expect(context.schema).toBe(component.schema)
      expect(context.user).toBe(component.user)
      expect(context.api).toBe(component.api)
      expect(context.views).toBe(component.views)
      expect(context.flattenedViews).toBe(component.flattenedViews)
      expect(context.itemLabel).toBe('Book')
      expect(context.itemLabelText).toBe('Book')
      expect(context.formLabel).toBe('Books')
      expect(context.formComponent).toBe(component.formComponent)
      expect(context.query).toEqual({ page: '2' })
    })

    it('returns the text of the item label with unescaped values', () => {
      const context = new DitoContext(createComponent(), {
        itemLabel: `<b>Show</b> 'Tom &amp; Jerry &lt;b&gt;'`
      })
      expect(context.itemLabelText).toBe(`Show 'Tom & Jerry <b>'`)
    })

    it('overrides the values of the component with its own', () => {
      const component = createComponent()
      const schema = { type: 'section' }
      const context = new DitoContext(component, { schema, user: null })
      expect(context.schema).toBe(schema)
      // Values explicitly set to `undefined` or `null` are kept too:
      expect(context.user).toBe(null)
      const undefinedContext = new DitoContext(component, { api: undefined })
      expect(undefinedContext.api).toBe(undefined)
    })

    it('returns `null` for values that neither provides', () => {
      const context = new DitoContext({}, {})
      expect(context.user).toBe(null)
      expect(context.api).toBe(null)
      expect(context.itemLabelText).toBe(null)
      expect(context.dialogComponent).toBe(null)
      expect(context.panelComponent).toBe(null)
      expect(context.resourceComponent).toBe(null)
      expect(context.sourceComponent).toBe(null)
      expect(context.viewComponent).toBe(null)
      expect(context.schemaComponent).toBe(null)
      expect(context.option).toBe(undefined)
      expect(context.options).toBe(undefined)
      expect(context.open).toBe(undefined)
      expect(context.searchTerm).toBe(undefined)
      expect(context.error).toBe(undefined)
      expect(context.wasNotified).toBe(false)
      expect(context.isRunning).toBe(false)
    })

    it('provides values of options and searches when given', () => {
      const option = { value: 'novel' }
      const context = new DitoContext(
        {},
        {
          option,
          options: [option],
          searchTerm: 'nov',
          open: true
        }
      )
      expect(context.option).toBe(option)
      expect(context.options).toEqual([option])
      expect(context.searchTerm).toBe('nov')
      expect(context.open).toBe(true)
    })

    it('delegates the helper methods to the component', async () => {
      const component = createComponent()
      const { request, format, navigate, download, getResourceUrl } =
        new DitoContext(component, {})
      expect(await request({ method: 'get' })).toEqual({
        options: { method: 'get' }
      })
      expect(format(3, { unit: 'kg' })).toBe('3 kg')
      navigate('/books')
      expect(component.navigate).toHaveBeenCalledWith('/books')
      download({ url: '/file' })
      expect(component.download).toHaveBeenCalledWith({ url: '/file' })
      expect(getResourceUrl({ path: 'books' })).toBe('/api/books')
    })

    it('remembers that a notification was shown', () => {
      const component = createComponent()
      const context = new DitoContext(component, {})
      const { notify } = context
      notify({ type: 'info', text: 'Saved' })
      expect(component.notify).toHaveBeenCalledWith({
        type: 'info',
        text: 'Saved'
      })
      expect(context.wasNotified).toBe(true)
    })

    it('stores whether its action is running', () => {
      const context = new DitoContext({}, {})
      context.isRunning = true
      expect(context.isRunning).toBe(true)
    })

    // Like Vue's component proxies, which write all values to the component,
    // also when they're assigned to objects that inherit from them.
    const createComponentProxy = component =>
      new Proxy(component, {
        set(target, key, value) {
          target[key] = value
          return true
        }
      })

    it(`doesn't remember notifications on the component`, () => {
      const component = { notify: vi.fn() }
      const proxy = createComponentProxy(component)
      const context = new DitoContext(proxy, {})
      context.notify({ type: 'info', text: 'Saved' })
      expect(context.wasNotified).toBe(true)
      expect(component).not.toHaveProperty('wasNotified')
      expect(new DitoContext(proxy, {}).wasNotified).toBe(false)
    })

    it('sets whether the action of the component is running on it', () => {
      // E.g. to end the running state of a button before its click handler
      // returns.
      const component = { isRunning: true }
      const context = new DitoContext(createComponentProxy(component), {})
      expect(context.isRunning).toBe(true)
      context.isRunning = false
      expect(component.isRunning).toBe(false)
      expect(context.isRunning).toBe(false)
    })
  })

  describe('creation', () => {
    it('creates the context object with functions', () => {
      const createContextObject = vi.fn(() => ({ dataPath: 'name' }))
      const context = new DitoContext(null, createContextObject)
      expect(context.dataPath).toBe('name')
      expect(createContextObject).toHaveBeenCalledTimes(1)
    })

    it(`doesn't modify the passed context object`, () => {
      const object = { dataPath: 'name' }
      const context = new DitoContext(null, object)
      expect(context.nested).toBe(true)
      expect(object).toEqual({ dataPath: 'name' })
    })

    it('returns existing contexts with `DitoContext.get()`', () => {
      const context = new DitoContext(null, {})
      expect(DitoContext.get(null, context)).toBe(context)
      const created = DitoContext.get(null, { dataPath: 'name' })
      expect(created).toBeInstanceOf(DitoContext)
      expect(created.dataPath).toBe('name')
    })

    it('works through reactive proxies', () => {
      const context = reactive(new DitoContext(null, { dataPath: 'name' }))
      expect(context.dataPath).toBe('name')
    })
  })

  describe('extend()', () => {
    it('overrides values and keeps the others', () => {
      // E.g. to pass a processed value on to a nested `process()` callback:
      const rootData = createLibrary()
      const context = new DitoContext(null, {
        rootData,
        dataPath: 'authors/0/books/0/tags'
      })
      const extended = context.extend({ value: ['classic'] })
      expect(extended.value).toEqual(['classic'])
      expect(extended.item).toBe(rootData.authors[0].books[0])
      expect(extended.dataPath).toBe('authors/0/books/0/tags')
      expect(extended).toBeInstanceOf(DitoContext)
    })

    it('shares the state of the extended context', () => {
      const context = new DitoContext({ notify() {} }, {})
      const extended = context.extend({})
      extended.notify({ text: 'Done' })
      expect(context.wasNotified).toBe(true)
    })
  })

  describe('createForSchema()', () => {
    it('creates the context of a component before it is rendered', () => {
      const rootData = createLibrary()
      const [book] = rootData.authors[0].books
      const schema = { type: 'text' }
      const context = DitoContext.createForSchema(null, {
        schema,
        name: 'title',
        data: book,
        dataPath: 'authors/0/books/0/title',
        rootData
      })
      expect(context.schema).toBe(schema)
      expect(context.nested).toBe(true)
      expect(context.item).toBe(book)
      expect(context.value).toBe('First')
      book.title = 'Changed'
      expect(context.value).toBe('Changed')
    })

    it('has no value for unnested components', () => {
      const book = { title: 'First' }
      const context = DitoContext.createForSchema(null, {
        schema: { type: 'section' },
        name: 'details',
        data: book,
        dataPath: '',
        rootData: book
      })
      expect(context.nested).toBe(false)
      expect(context.item).toBe(book)
      expect(context.value).toBe(undefined)
    })
  })

  describe('createChildContext()', () => {
    const rootData = createLibrary()
    const [author] = rootData.authors
    const createAuthorContext = schema =>
      DitoContext.createForSchema(null, {
        schema,
        name: 'books',
        data: author,
        dataPath: 'authors/0/books',
        rootData
      })

    it('reads the data of nested components from their values', () => {
      // E.g. nested sections, that store their components in an object:
      const books = { type: 'section', nested: true }
      const child = createAuthorContext(books).createChildContext(
        { type: 'text' },
        '0'
      )
      expect(child.item).toBe(author.books)
      expect(child.dataPath).toBe('authors/0/books/0')
      expect(child.value).toBe(author.books[0])
      expect(child.rootItem).toBe(rootData)
    })

    it('shares the data of unnested components', () => {
      const section = { type: 'section' }
      const parent = DitoContext.createForSchema(null, {
        schema: section,
        name: 'details',
        data: author,
        dataPath: 'authors/0',
        rootData
      })
      const child = parent.createChildContext({ type: 'text' }, 'name')
      expect(child.item).toBe(author)
      expect(child.dataPath).toBe('authors/0/name')
      expect(child.value).toBe('Ann')
      // Unnested children keep the data path of their parent:
      const unnested = parent.createChildContext({ type: 'section' }, 'inner')
      expect(unnested.dataPath).toBe('authors/0')
      expect(unnested.item).toBe(author)
    })

    it('uses the item of contexts without a schema', () => {
      // E.g. the contexts of menus and panels:
      const context = new DitoContext(null, {
        data: author,
        rootData,
        dataPath: 'authors/0',
        nested: false
      })
      const child = context.createChildContext({ type: 'text' }, 'name')
      expect(child.item).toBe(author)
      expect(child.value).toBe('Ann')
    })
  })
})
