import { vi } from 'vitest'
import { reactive, isReactive } from 'vue'
import { hyphenate } from '@ditojs/utils'
import DitoMixin from '../../mixins/DitoMixin.js'
import TypeMixin from '../../mixins/TypeMixin.js'
import { registerTypeComponent } from './types.js'
import {
  resolveSchema,
  resolveSchemas,
  resolveViews,
  flattenViews,
  resolveSchemaComponent,
  resolveSchemaComponents,
  setupSchemaComponents,
  setupView,
  applySchemaDefaults,
  applyNestedSchemaDefaults,
  setupRouteSchema,
  setupForms,
  setupForm,
  setupTab,
  setupPanel,
  setupNestedSchemas
} from './setup.js'

// Register minimal type options, as the actual type components can't be
// imported without a Vue SFC compiler. Their `processSchema()` delegate to the
// setup functions like the actual types do:
registerTypeComponent('text', { defaultNested: true })
registerTypeComponent('section', {
  defaultNested: false,
  processSchema: (api, schema, name, routes, level) =>
    setupSchemaComponents(api, schema, routes, level)
})
registerTypeComponent('panel', {
  defaultNested: false,
  processSchema: (api, schema, name, routes, level) =>
    setupSchemaComponents(api, schema, routes, level)
})
// Like `SourceMixin.processSchema()`, adding a route per list with the routes
// of its forms as children:
registerTypeComponent('list', {
  defaultNested: true,
  async processSchema(api, schema, name, routes, level) {
    setupRouteSchema(api, schema, name)
    const children = await setupForms(api, schema, level)
    routes?.push({ path: schema.path, level, children })
  }
})
registerTypeComponent('component', {
  processSchema: (api, schema) => resolveSchemaComponent(schema)
})

function createApi(defaults = {}) {
  return { defaults, normalizePath: path => hyphenate(path) }
}

// Creates an object that behaves like the module namespace object returned by
// dynamic `import()`, with `exports` as its exports:
function createModule(exports) {
  return Object.defineProperty(
    Object.assign(Object.create(null), exports),
    Symbol.toStringTag,
    { value: 'Module' }
  )
}

const createBookForm = () => ({
  type: 'form',
  components: {
    title: { type: 'text' },
    isbn: { type: 'text' }
  }
})

describe('resolveSchema()', () => {
  it('returns schemas that are objects as they are', async () => {
    const schema = createBookForm()
    expect(await resolveSchema(schema)).toBe(schema)
  })

  it('calls functions and awaits promises, e.g. of lazy imports', async () => {
    const schema = createBookForm()
    expect(await resolveSchema(async () => schema)).toBe(schema)
    expect(await resolveSchema(Promise.resolve(schema))).toBe(schema)
  })

  it('resolves each value only once', async () => {
    const schema = createBookForm()
    const load = vi.fn(async () => schema)
    expect(await resolveSchema(load)).toBe(schema)
    expect(await resolveSchema(load)).toBe(schema)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('unwraps the default export of modules', async () => {
    const schema = createBookForm()
    const module = createModule({ default: schema })
    expect(await resolveSchema(Promise.resolve(module))).toBe(schema)
  })

  it('unwraps single named exports and names them after the export', async () => {
    const schema = createBookForm()
    const module = createModule({ bookForm: schema })
    expect(await resolveSchema(module, true)).toEqual({
      ...schema,
      name: 'bookForm'
    })
    // Without `unwrapModule`, named exports are kept as a plain object:
    expect(await resolveSchema(createModule({ bookForm: schema }))).toEqual({
      bookForm: schema
    })
  })

  it('ignores the key that vite adds to modules on hot reloads', async () => {
    const schema = createBookForm()
    const module = createModule({ bookForm: schema, _rerender_only: true })
    expect(await resolveSchema(module, true)).toEqual({
      ...schema,
      name: 'bookForm'
    })
  })

  it('keeps modules with multiple named exports as plain objects', async () => {
    const authors = createBookForm()
    const books = createBookForm()
    const module = createModule({ authors, books })
    expect(await resolveSchema(module, true)).toEqual({ authors, books })
  })
})

describe('resolveSchemas()', () => {
  it('names the schemas of arrays of modules after their exports', async () => {
    const books = { type: 'view', label: 'Books' }
    const authors = { type: 'view', label: 'Authors' }
    const schemas = await resolveSchemas([
      Promise.resolve(createModule({ books })),
      Promise.resolve(createModule({ authors }))
    ])
    expect(schemas).toEqual({
      books: { ...books, name: 'books' },
      authors: { ...authors, name: 'authors' }
    })
    expect(Object.keys(schemas)).toEqual(['books', 'authors'])
  })

  it('resolves the values of objects by their keys', async () => {
    const book = createBookForm()
    const author = createBookForm()
    expect(
      await resolveSchemas({
        book: Promise.resolve(createModule({ default: book })),
        author
      })
    ).toEqual({ book, author })
  })

  it('resolves lazily imported modules with default exports', async () => {
    // E.g. `views: () => import('./views/index.js')`, with an array of lazy
    // imports as the default export:
    const books = { type: 'view', label: 'Books' }
    const schemas = await resolveSchemas(async () =>
      createModule({
        default: [Promise.resolve(createModule({ books }))]
      })
    )
    expect(schemas).toEqual({ books: { ...books, name: 'books' } })
  })

  it('resolves the items with `resolveItem()`', async () => {
    const resolveItem = vi.fn(async (item, unwrapModule) => ({
      ...item,
      unwrapModule
    }))
    expect(
      await resolveSchemas({ book: { type: 'form' } }, resolveItem)
    ).toEqual({ book: { type: 'form', unwrapModule: true } })
  })
})

describe('resolveViews()', () => {
  it('names sub-menus after their labels and resolves their items', async () => {
    const books = { type: 'view', label: 'Books' }
    const views = await resolveViews([
      {
        type: 'menu',
        label: 'Library Catalog',
        items: [Promise.resolve(createModule({ books }))]
      }
    ])
    expect(views).toEqual({
      libraryCatalog: {
        type: 'menu',
        label: 'Library Catalog',
        name: 'libraryCatalog',
        items: { books: { ...books, name: 'books' } }
      }
    })
  })

  // Bug: The items of menus that have a name, e.g. menus exported by name from
  // their own modules, aren't resolved, so their views can't be set up.
  test.fails('resolves the items of named sub-menus too', async () => {
    const books = { type: 'view', label: 'Books' }
    const catalog = {
      type: 'menu',
      label: 'Catalog',
      items: [Promise.resolve(createModule({ books }))]
    }
    const views = await resolveViews([
      Promise.resolve(createModule({ catalog }))
    ])
    expect(views.catalog.items).toEqual({ books: { ...books, name: 'books' } })
  })
})

describe('flattenViews()', () => {
  it('moves the items of menus to the top level', () => {
    const books = { type: 'view', name: 'books' }
    const authors = { type: 'view', name: 'authors' }
    const loans = { type: 'view', name: 'loans' }
    const views = flattenViews({
      catalog: { type: 'menu', items: { books, authors } },
      loans
    })
    expect(views).toEqual({ books, authors, loans })
  })
})

describe('applySchemaDefaults()', () => {
  it('sets the missing values of the defaults of the type', () => {
    const api = createApi({ text: { trim: true, maxLength: 100 } })
    const schema = { type: 'text', maxLength: 20 }
    applySchemaDefaults(api, schema)
    expect(schema.trim).toBe(true)
  })

  it('looks up the defaults of hyphenated types by their camelized names', () => {
    const api = createApi({ treeList: { collapsible: true } })
    const schema = { type: 'tree-list' }
    applySchemaDefaults(api, schema)
    expect(schema.collapsible).toBe(true)
  })

  it('calls defaults that are functions with the schema', () => {
    // E.g. custom types that expand to a built-in type with extra settings:
    const api = createApi({
      ratings: ({ type, ...schema }) => ({
        ...schema,
        type: 'list',
        sortable: false
      })
    })
    const schema = { type: 'ratings', label: 'Ratings' }
    applySchemaDefaults(api, schema)
    expect(schema).toEqual({ type: 'list', label: 'Ratings', sortable: false })
  })

  it('merges defaults deeply into existing objects', () => {
    const api = createApi({ text: { format: { trim: true } } })
    const schema = { type: 'text', format: { case: 'lower' } }
    applySchemaDefaults(api, schema)
    expect(schema.format).toEqual({ case: 'lower', trim: true })
  })

  it('overrides existing values with the values of the defaults', () => {
    // Documents the current behavior: Defaults aren't only applied to missing
    // values, see `assignDeeply()`.
    const api = createApi({ text: { trim: true } })
    const schema = { type: 'text', trim: false }
    applySchemaDefaults(api, schema)
    expect(schema.trim).toBe(true)
  })

  it('leaves schemas without defaults for their type alone', () => {
    const api = createApi({ text: () => null })
    const schema = { type: 'text' }
    applySchemaDefaults(api, schema)
    applySchemaDefaults(createApi(), { type: 'section' })
    expect(schema).toEqual({ type: 'text' })
  })
})

describe('applyNestedSchemaDefaults()', () => {
  it('applies defaults to components in sections, tabs and forms', () => {
    const api = createApi({ text: { trim: true } })
    const schema = {
      type: 'form',
      components: {
        title: { type: 'text' },
        details: {
          type: 'section',
          components: { subtitle: { type: 'text' } }
        },
        chapters: {
          type: 'list',
          form: { type: 'form', components: { heading: { type: 'text' } } }
        }
      },
      tabs: {
        notes: { type: 'tab', components: { remark: { type: 'text' } } }
      }
    }
    applyNestedSchemaDefaults(api, schema)
    const { components, tabs } = schema
    expect(components.title.trim).toBe(true)
    expect(components.details.components.subtitle.trim).toBe(true)
    expect(components.chapters.form.components.heading.trim).toBe(true)
    expect(tabs.notes.components.remark.trim).toBe(true)
  })

  it('skips components created by `components()` callbacks', () => {
    const api = createApi({ text: { trim: true } })
    const components = vi.fn(() => ({ title: { type: 'text' } }))
    applyNestedSchemaDefaults(api, {
      type: 'form',
      components: { fields: { type: 'section', components } }
    })
    expect(components).not.toHaveBeenCalled()
  })
})

describe('setupRouteSchema()', () => {
  it('sets the name and path, and the full path if given', () => {
    const api = createApi()
    const schema = { type: 'view' }
    setupRouteSchema(api, schema, 'bookLoans', '/library')
    expect(schema).toEqual({
      type: 'view',
      name: 'bookLoans',
      path: 'book-loans',
      fullPath: '/library/book-loans'
    })
  })

  it('keeps existing names and paths', () => {
    const api = createApi()
    const schema = { type: 'view', name: 'loans', path: 'lending' }
    setupRouteSchema(api, schema, 'bookLoans')
    expect(schema).toEqual({ type: 'view', name: 'loans', path: 'lending' })
  })
})

describe('setupForm()', () => {
  it('resolves forms, applies defaults and sets up their components', async () => {
    const api = createApi({
      form: { compact: true },
      text: { trim: true }
    })
    const form = await setupForm(
      api,
      Promise.resolve(createModule({ default: createBookForm() }))
    )
    expect(form.compact).toBe(true)
    expect(form.components.title.trim).toBe(true)
    expect(form.components.isbn.trim).toBe(true)
  })

  it(`rejects schemas that aren't forms`, async () => {
    await expect(setupForm(createApi(), { type: 'view' })).rejects.toThrow(
      `Invalid form schema: '{"type":"view"}'`
    )
  })

  it('sets up the components of nested sections', async () => {
    const api = createApi({ text: { trim: true } })
    const form = await setupForm(api, {
      type: 'form',
      components: {
        details: {
          type: 'section',
          components: { subtitle: { type: 'text' } }
        }
      }
    })
    expect(form.components.details.components.subtitle.trim).toBe(true)
  })

  it('resolves the tabs and panels of forms', async () => {
    const api = createApi({
      tab: { defaultTab: false },
      panel: { sticky: true },
      text: { trim: true }
    })
    const form = await setupForm(api, {
      type: 'form',
      tabs: {
        notes: Promise.resolve(
          createModule({
            default: { type: 'tab', components: { remark: { type: 'text' } } }
          })
        )
      },
      panels: [
        Promise.resolve(
          createModule({
            summary: {
              type: 'panel',
              components: { excerpt: { type: 'text' } }
            }
          })
        )
      ]
    })
    expect(form.tabs.notes).toEqual({
      type: 'tab',
      defaultTab: false,
      components: { remark: { type: 'text', trim: true } }
    })
    expect(form.panels.summary).toEqual({
      type: 'panel',
      name: 'summary',
      sticky: true,
      components: { excerpt: { type: 'text', trim: true } }
    })
  })

  it('sets up each form only once, also when it is recursive', async () => {
    // E.g. categories with lists of sub-categories that use the same form:
    const api = createApi()
    const categoryForm = { type: 'form', components: {} }
    categoryForm.components.subcategories = {
      type: 'list',
      form: categoryForm
    }
    const routes = []
    await setupForm(api, categoryForm, routes)
    expect(routes).toEqual([
      { path: 'subcategories', level: 1, children: [] }
    ])
  })

  it('sets up recursive forms up to `maxDepth` times', async () => {
    const api = createApi()
    const categoryForm = { type: 'form', components: {} }
    categoryForm.components.subcategories = {
      type: 'list',
      form: categoryForm,
      maxDepth: 2
    }
    const routes = []
    await setupForm(api, categoryForm, routes)
    expect(routes).toEqual([
      {
        path: 'subcategories',
        level: 1,
        children: [{ path: 'subcategories', level: 2, children: [] }]
      }
    ])
  })
})

describe('setupForms()', () => {
  it('resolves `form` and stores it back on the schema', async () => {
    const api = createApi({ text: { trim: true } })
    const schema = {
      type: 'list',
      form: Promise.resolve(createModule({ default: createBookForm() }))
    }
    await setupForms(api, schema, 0)
    expect(schema.form.components.title.trim).toBe(true)
  })

  it('resolves `forms` and stores them back on the schema', async () => {
    const api = createApi({ text: { trim: true } })
    const schema = {
      type: 'list',
      forms: {
        novel: Promise.resolve(createModule({ default: createBookForm() })),
        comic: createBookForm()
      }
    }
    await setupForms(api, schema, 0)
    expect(Object.keys(schema.forms)).toEqual(['novel', 'comic'])
    expect(schema.forms.novel.components.title.trim).toBe(true)
    expect(schema.forms.comic.components.isbn.trim).toBe(true)
  })

  it('sets up inlined components without storing a form', async () => {
    const api = createApi({ text: { trim: true } })
    const schema = {
      type: 'object',
      components: { street: { type: 'text' } }
    }
    await setupForms(api, schema, 0)
    expect(schema.components.street.trim).toBe(true)
    expect(schema.form).toBe(undefined)
  })

  it('returns the routes of the nested lists of its forms', async () => {
    const api = createApi()
    const schema = {
      type: 'list',
      form: {
        type: 'form',
        components: {
          chapters: {
            type: 'list',
            form: { type: 'form', components: {} }
          }
        }
      }
    }
    expect(await setupForms(api, schema, 1)).toEqual([
      { path: 'chapters', level: 2, children: [] }
    ])
  })

  it('leaves `components()` callbacks to be set up with the data', async () => {
    const api = createApi()
    const components = vi.fn(() => ({}))
    expect(await setupForms(api, { type: 'section', components }, 0)).toEqual(
      []
    )
    expect(components).not.toHaveBeenCalled()
  })
})

describe('setupNestedSchemas()', () => {
  it('rejects tabs and panels of the wrong type', async () => {
    const api = createApi()
    await expect(
      setupNestedSchemas(api, { tabs: { notes: { type: 'panel' } } })
    ).rejects.toThrow(`Invalid tab schema: '{"type":"panel"}'`)
    await expect(
      setupNestedSchemas(api, { panels: { notes: { type: 'tab' } } })
    ).rejects.toThrow(`Invalid panel schema: '{"type":"tab"}'`)
  })

  it('resolves single tabs and panels', async () => {
    const api = createApi()
    const tab = { type: 'tab' }
    const panel = { type: 'panel' }
    expect(await setupTab(api, async () => tab)).toBe(tab)
    expect(await setupPanel(api, async () => panel)).toBe(panel)
  })
})

describe('setupSchemaComponents()', () => {
  it('sets up the components of panels too', async () => {
    const api = createApi({ text: { trim: true } })
    const schema = {
      type: 'form',
      components: {},
      panels: {
        summary: { type: 'panel', components: { excerpt: { type: 'text' } } }
      }
    }
    await setupSchemaComponents(api, schema)
    expect(schema.panels.summary.components.excerpt.trim).toBe(true)
  })

  it('ignores missing schemas', () => {
    expect(setupSchemaComponents(createApi(), null)).toBe(undefined)
  })
})

describe('setupView()', () => {
  const DitoView = { name: 'DitoView' }

  it('creates the route of views with the routes of their lists', async () => {
    const api = createApi({ text: { trim: true } })
    const books = {
      type: 'view',
      component: {
        type: 'list',
        form: createBookForm()
      }
    }
    const route = await setupView(DitoView, api, books, 'books')
    expect(route).toEqual({
      path: '/books',
      children: [{ path: 'books', level: 0, children: [] }],
      component: DitoView,
      meta: { api, schema: books }
    })
    expect(books.component.form.components.title.trim).toBe(true)
  })

  it('resolves the tabs of views', async () => {
    const api = createApi({ text: { trim: true } })
    const dashboard = {
      type: 'view',
      components: {},
      tabs: {
        stats: Promise.resolve(
          createModule({
            default: { type: 'tab', components: { total: { type: 'text' } } }
          })
        )
      }
    }
    await setupView(DitoView, api, dashboard, 'dashboard')
    expect(dashboard.tabs.stats.components.total.trim).toBe(true)
  })

  it('creates the routes of menus with their items as children', async () => {
    const api = createApi()
    const catalog = {
      type: 'menu',
      items: {
        bookAuthors: { type: 'view', components: {} }
      }
    }
    const route = await setupView(DitoView, api, catalog, 'catalog')
    expect(route.path).toBe('/catalog')
    expect(route.children).toEqual([
      {
        path: '/catalog/book-authors',
        children: [],
        component: DitoView,
        meta: { api, schema: catalog.items.bookAuthors }
      }
    ])
  })

  it('rejects schemas that are neither views nor menus', async () => {
    await expect(
      setupView(DitoView, createApi(), { type: 'form' }, 'books')
    ).rejects.toThrow('Invalid view schema')
  })
})

describe('resolveSchemaComponent()', () => {
  it('adds the mixins of type components to custom components', async () => {
    const OwnMixin = { methods: { own() {} } }
    const component = { name: 'BookCover', mixins: [OwnMixin] }
    const schema = {
      type: 'component',
      component: Promise.resolve(createModule({ default: component }))
    }
    await resolveSchemaComponent(schema)
    expect(schema.component).toEqual({
      name: 'BookCover',
      mixins: [DitoMixin, TypeMixin, OwnMixin]
    })
  })

  it(`marks the components as raw so they don't become reactive`, async () => {
    const schema = { type: 'component', component: { name: 'BookCover' } }
    await resolveSchemaComponent(schema)
    expect(isReactive(reactive(schema).component)).toBe(false)
  })

  it('leaves schemas without components alone', async () => {
    const schema = { type: 'component' }
    await resolveSchemaComponent(schema)
    expect(schema).toEqual({ type: 'component' })
  })

  it('resolves the components of all schemas, e.g. columns', async () => {
    const columns = {
      cover: { component: async () => ({ name: 'BookCover' }) },
      title: { label: 'Title' }
    }
    await resolveSchemaComponents(columns)
    await resolveSchemaComponents(null)
    expect(columns.cover.component.mixins).toEqual([DitoMixin, TypeMixin])
    expect(columns.title).toEqual({ label: 'Title' })
  })

  it('sets up custom components through their type', async () => {
    const api = createApi()
    const form = await setupForm(api, {
      type: 'form',
      components: {
        cover: { type: 'component', component: { name: 'BookCover' } }
      }
    })
    expect(form.components.cover.component.mixins).toEqual([
      DitoMixin,
      TypeMixin
    ])
  })
})
