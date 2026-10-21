import { vi } from 'vitest'
import { reactive, isReactive } from 'vue'
import { hyphenate, html } from '@ditojs/utils'
import { defineType } from './types.ts'
import { sourceTraits, numberTraits } from '../../types/traits.ts'
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
  setupForms,
  setupForm,
  setupTab,
  setupPanel,
  setupNestedSchemas
} from './setup.js'

// Define minimal types, as the actual type components can't be
// imported without a Vue SFC compiler. Their `setupSchema()` delegate to the
// setup functions like the actual types do:
defineType({ type: 'text' })
defineType({
  type: 'section',
  defaultNested: false,
  setupSchema: ({ schema, api }) => setupSchemaComponents(api, schema)
})
defineType({
  type: 'panel',
  defaultNested: false,
  setupSchema: ({ schema, api }) => setupSchemaComponents(api, schema)
})
defineType({ ...sourceTraits, type: 'list', sourceType: 'list' })
defineType({
  type: 'component',
  setupSchema: ({ schema }) => resolveSchemaComponent(schema)
})
defineType({ type: 'value', resolvesValue: true })
defineType({ type: 'date', hasFormat: true })
defineType({ ...numberTraits, type: 'number' })

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
  fields: {
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

  it('returns values that are no schemas as they are', async () => {
    expect(await resolveSchema(undefined)).toBe(undefined)
    expect(await resolveSchema(null)).toBe(null)
    expect(await resolveSchema('books')).toBe('books')
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

  it('returns resolved values that are neither arrays nor objects', async () => {
    // E.g. lazy imports of optional schemas that resolve to nothing:
    expect(await resolveSchemas(async () => null)).toBe(null)
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

  it('names sub-menus after the text of `{ text }` and `html` labels', async () => {
    const views = await resolveViews([
      { type: 'menu', label: { text: 'New Books' }, items: [] },
      { type: 'menu', label: html`<b>Used</b> Books`, items: [] }
    ])
    expect(Object.keys(views)).toEqual(['newBooks', 'usedBooks'])
  })

  it('resolves the items of named sub-menus too', async () => {
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

  it('rejects menus without items', async () => {
    await expect(
      resolveViews([{ type: 'menu', label: 'Catalog' }])
    ).rejects.toThrow(
      `Invalid items of menu 'catalog': Must be an object or an array.`
    )
  })

  it('rejects views that are no object or array', async () => {
    for (const views of [undefined, null, () => undefined]) {
      await expect(resolveViews(views)).rejects.toThrow(
        'Invalid views: Must be an object or an array.'
      )
    }
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

  it('looks up the defaults of hyphenated types by their names', () => {
    const api = createApi({ 'tree-list': { collapsible: true } })
    const schema = { type: 'tree-list' }
    applySchemaDefaults(api, schema)
    expect(schema.collapsible).toBe(true)
  })

  it('looks up the defaults of hyphenated types by their camelized names', () => {
    // E.g. from the exports of a module, `import * as defaults`:
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
    const defaults = { options: { value: 'id' } }
    const api = createApi({ text: defaults })
    const schema = { type: 'text', options: { label: 'name' } }
    applySchemaDefaults(api, schema)
    expect(schema.options).toEqual({ label: 'name', value: 'id' })
    expect(defaults).toEqual({ options: { value: 'id' } })
  })

  it('keeps the values that the schema sets itself', () => {
    const api = createApi({
      text: { trim: true, options: { label: 'title', value: 'id' } }
    })
    const schema = { type: 'text', trim: false, options: { label: 'name' } }
    applySchemaDefaults(api, schema)
    expect(schema.trim).toBe(false)
    expect(schema.options).toEqual({ label: 'name', value: 'id' })
  })

  it('overrides the schema with the values that default functions return', () => {
    const api = createApi({
      text: () => ({ trim: true, options: { label: 'title' } })
    })
    const schema = { type: 'text', trim: false, options: { label: 'name' } }
    applySchemaDefaults(api, schema)
    expect(schema.trim).toBe(true)
    expect(schema.options).toEqual({ label: 'title' })
  })

  it('applies the defaults of their type to buttons', () => {
    const api = createApi({ submit: { closeForm: true } })
    const schema = {
      type: 'form',
      buttons: { save: { type: 'submit' }, cancel: {}, back: 'Back' }
    }
    applySchemaDefaults(api, schema)
    expect(schema.buttons).toEqual({
      save: { type: 'submit', closeForm: true },
      cancel: {},
      back: 'Back'
    })
  })

  it('leaves schemas without defaults for their type alone', () => {
    const api = createApi({ text: () => null })
    const schema = { type: 'text' }
    applySchemaDefaults(api, schema)
    applySchemaDefaults(createApi(), { type: 'section' })
    expect(schema).toEqual({ type: 'text' })
  })
})

describe('the schema keys of 3.x', () => {
  const setupBookView = fields =>
    setupView(createApi(), { type: 'view', fields }, 'books')

  it.each([
    ['format', 'formatValue()'],
    ['parse', 'parseValue()'],
    ['compute', 'computeValue()'],
    ['process', 'serializeValue()']
  ])('rejects the value hook %s() with its replacement', async (key, hook) => {
    await expect(
      setupBookView({ title: { type: 'text', [key]: ({ value }) => value } })
    ).rejects.toThrow(
      `Unsupported schema key '${key}' in 'title': Use '${hook}' instead.`
    )
  })

  it.each(['methods', 'computed', 'watch', 'data'])(
    'rejects the component member definitions in %s',
    async key => {
      await expect(
        setupForm(createApi(), { type: 'form', [key]: {}, fields: {} })
      ).rejects.toThrow(`Unsupported schema key '${key}' in 'form'`)
    }
  )

  it.each([
    ['onCreate', { onCreate() {} }],
    ['onSubmit', { onSubmit() {} }]
  ])('rejects the event %s of forms', async (key, schema) => {
    await expect(
      setupForm(createApi(), { type: 'form', fields: {}, ...schema })
    ).rejects.toThrow(
      `Unsupported schema key '${key}' in 'form': ` +
      `Use 'onSuccess()' with 'context.isCreating' instead.`
    )
  })

  it('rejects the event onOpen() of collapsible schemas', async () => {
    await expect(
      setupBookView({
        details: { type: 'section', collapsible: true, onOpen() {} }
      })
    ).rejects.toThrow(
      `Unsupported schema key 'onOpen' in 'details': Use 'onToggle()', or ` +
      `'form: { onToggle() }' in lists and objects, instead.`
    )
  })

  it('rejects the formats of dates', async () => {
    await expect(
      setupBookView({ published: { type: 'date', formats: {} } })
    ).rejects.toThrow(
      `Unsupported schema key 'formats' in 'published': Use 'format' instead.`
    )
  })

  it.each([
    ['relateBy', 'relate: <key>'],
    ['groupBy', 'options.group']
  ])('rejects the option setting %s with its replacement', async (key, by) => {
    await expect(
      setupBookView({ author: { type: 'text', [key]: 'id' } })
    ).rejects.toThrow(
      `Unsupported schema key '${key}' in 'author': Use '${by}' instead.`
    )
  })

  it('rejects keys that the defaults of the type add', () => {
    const api = createApi({ text: { process: ({ value }) => value } })
    expect(() => applySchemaDefaults(api, { type: 'text' }, 'title')).toThrow(
      `Unsupported schema key 'process' in 'title'`
    )
  })

  it.each([
    [
      'lists',
      {
        books: {
          type: 'list',
          form: createBookForm(),
          buttons: { order: { type: 'button', data: {} } }
        }
      }
    ],
    [
      'panels',
      {
        filters: {
          type: 'panel',
          fields: {},
          panelButtons: { order: { type: 'button', data: {} } }
        }
      }
    ],
    [
      'the panels of components',
      {
        title: {
          type: 'text',
          panels: {
            hints: {
              type: 'panel',
              fields: {},
              buttons: { order: { type: 'button', data: {} } }
            }
          }
        }
      }
    ]
  ])('rejects the keys of the buttons of %s', async (_, fields) => {
    await expect(setupBookView(fields)).rejects.toThrow(
      `Unsupported schema key 'data' in 'order'`
    )
  })

  it('rejects the keys of the buttons of forms, also without a type', async () => {
    await expect(
      setupForm(createApi(), {
        type: 'form',
        fields: {},
        buttons: { submit: { data: {} } }
      })
    ).rejects.toThrow(`Unsupported schema key 'data' in 'submit'`)
  })

  it('keeps the format of types that read it', async () => {
    await expect(
      setupBookView({
        published: { type: 'date', format: { day: 'numeric' } }
      })
    ).resolves.toBe(undefined)
  })

  it('keeps the data of panels and of types that resolve their value', async () => {
    await expect(
      setupBookView({
        count: { type: 'value', data: () => ({}) },
        filters: { type: 'panel', data: () => ({}), fields: {} }
      })
    ).resolves.toBe(undefined)
  })
})

describe('the schema key nested', () => {
  const setupBookView = fields =>
    setupView(createApi(), { type: 'view', fields }, 'books')

  it.each([true, false])(
    'rejects nested: %s on types that nest their data anyway',
    async nested => {
      await expect(
        setupBookView({ title: { type: 'text', nested } })
      ).rejects.toThrow(
        `Unsupported schema key 'nested' in 'title': ` +
        `Only sections and panels support it.`
      )
    }
  )

  it('keeps nested of sections and panels', async () => {
    await expect(
      setupBookView({
        details: { type: 'section', nested: true, fields: {} },
        filters: { type: 'panel', nested: false, fields: {} }
      })
    ).resolves.toBe(undefined)
  })

  it('rejects nested panels with their own data', async () => {
    await expect(
      setupBookView({
        search: { type: 'panel', nested: true, data: {}, fields: {} }
      })
    ).rejects.toThrow(
      `Unsupported schema key 'nested' in 'search': ` +
      `Panels with their own data can't be nested.`
    )
  })
})

describe('the schema keys of 5.x', () => {
  const setupBookView = fields =>
    setupView(createApi(), { type: 'view', fields }, 'books')

  it('rejects components with its replacement fields', async () => {
    await expect(
      setupBookView({
        details: { type: 'section', components: { title: { type: 'text' } } }
      })
    ).rejects.toThrow(
      `Unsupported schema key 'components' in 'details': Use 'fields' instead.`
    )
  })

  it('rejects the components of the defaults of the type', () => {
    const api = createApi({ section: { components: {} } })
    expect(() =>
      applySchemaDefaults(api, { type: 'section' }, 'details')
    ).toThrow(`Unsupported schema key 'components' in 'details'`)
  })

  it('rejects the component of views with its replacement field', async () => {
    await expect(
      setupView(
        createApi(),
        { type: 'view', component: { type: 'list', form: createBookForm() } },
        'books'
      )
    ).rejects.toThrow(
      `Unsupported schema key 'component' in 'books': Use 'field' instead.`
    )
  })

  it('keeps the Vue components of forms, sections, fields and pages', async () => {
    const layout = { name: 'BookLayout' }
    const form = await setupForm(createApi(), {
      type: 'form',
      component: layout,
      fields: {
        details: {
          type: 'section',
          component: layout,
          fields: { title: { type: 'text' } }
        },
        rating: { type: 'component', component: layout }
      }
    })
    const page = { type: 'page', component: layout }
    await setupView(createApi(), page, 'tools')
    expect(form.component).toBe(layout)
    expect(form.fields.details.component).toBe(layout)
    expect(form.fields.rating.component).toBe(layout)
    expect(page.component).toBe(layout)
  })

  it('rejects rules with the limits of fields as replacement', async () => {
    await expect(
      setupBookView({ title: { type: 'text', rules: { minLength: 2 } } })
    ).rejects.toThrow(
      `Unsupported schema key 'rules' in 'title': Use the limits of fields, ` +
      `their types and 'validate()' instead.`
    )
  })

  it('rejects events with the on… handlers as replacement', async () => {
    await expect(
      setupBookView({ title: { type: 'text', events: { change() {} } } })
    ).rejects.toThrow(
      `Unsupported schema key 'events' in 'title': ` +
      `Use the 'on…' handlers, e.g. 'onChange()', instead.`
    )
  })

  it.each([
    ['min', 'minimum'],
    ['max', 'maximum']
  ])('rejects %s of number types with its replacement', async (key, by) => {
    await expect(
      setupBookView({ price: { type: 'number', [key]: 1 } })
    ).rejects.toThrow(
      `Unsupported schema key '${key}' in 'price': Use '${by}' instead.`
    )
  })

  it('keeps min and max of other types', async () => {
    await expect(
      setupBookView({ title: { type: 'text', min: 0, max: 1 } })
    ).resolves.toBe(undefined)
  })
})

describe('applyNestedSchemaDefaults()', () => {
  it('applies defaults to components in sections, tabs and forms', () => {
    const api = createApi({ text: { trim: true } })
    const schema = {
      type: 'form',
      fields: {
        title: { type: 'text' },
        details: {
          type: 'section',
          fields: { subtitle: { type: 'text' } }
        },
        chapters: {
          type: 'list',
          form: { type: 'form', fields: { heading: { type: 'text' } } }
        }
      },
      tabs: {
        notes: { type: 'tab', fields: { remark: { type: 'text' } } }
      }
    }
    applyNestedSchemaDefaults(api, schema)
    const { fields, tabs } = schema
    expect(fields.title.trim).toBe(true)
    expect(fields.details.fields.subtitle.trim).toBe(true)
    expect(fields.chapters.form.fields.heading.trim).toBe(true)
    expect(tabs.notes.fields.remark.trim).toBe(true)
  })

  it('skips components created by `fields()` callbacks', () => {
    const api = createApi({ text: { trim: true } })
    const fields = vi.fn(() => ({ title: { type: 'text' } }))
    applyNestedSchemaDefaults(api, {
      type: 'form',
      fields: { fields: { type: 'section', fields } }
    })
    expect(fields).not.toHaveBeenCalled()
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
    expect(form.fields.title.trim).toBe(true)
    expect(form.fields.isbn.trim).toBe(true)
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
      fields: {
        details: {
          type: 'section',
          fields: { subtitle: { type: 'text' } }
        }
      }
    })
    expect(form.fields.details.fields.subtitle.trim).toBe(true)
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
            default: { type: 'tab', fields: { remark: { type: 'text' } } }
          })
        )
      },
      panels: [
        Promise.resolve(
          createModule({
            summary: {
              type: 'panel',
              fields: { excerpt: { type: 'text' } }
            }
          })
        )
      ]
    })
    expect(form.tabs.notes).toEqual({
      type: 'tab',
      defaultTab: false,
      fields: { remark: { type: 'text', trim: true } }
    })
    expect(form.panels.summary).toEqual({
      type: 'panel',
      name: 'summary',
      sticky: true,
      fields: { excerpt: { type: 'text', trim: true } }
    })
  })

  it('sets up each form only once, also when it is recursive', async () => {
    // E.g. categories with lists of sub-categories that use the same form:
    const setupList = vi.fn()
    const api = createApi({ list: setupList })
    const categoryForm = { type: 'form', fields: {} }
    categoryForm.fields.subcategories = {
      type: 'list',
      form: categoryForm
    }
    await setupForm(api, categoryForm)
    expect(setupList).toHaveBeenCalledTimes(1)
    expect(categoryForm.fields.subcategories.name).toBe('subcategories')
  })
})

describe('setupForms()', () => {
  it('resolves `form` and stores it back on the schema', async () => {
    const api = createApi({ text: { trim: true } })
    const schema = {
      type: 'list',
      form: Promise.resolve(createModule({ default: createBookForm() }))
    }
    await setupForms(api, schema)
    expect(schema.form.fields.title.trim).toBe(true)
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
    await setupForms(api, schema)
    expect(Object.keys(schema.forms)).toEqual(['novel', 'comic'])
    expect(schema.forms.novel.fields.title.trim).toBe(true)
    expect(schema.forms.comic.fields.isbn.trim).toBe(true)
  })

  it('resolves the component of forms', async () => {
    const schema = {
      type: 'list',
      name: 'books',
      form: {
        type: 'form',
        component: async () => ({ name: 'BookLayout' }),
        fields: {}
      }
    }
    await setupForms(createApi(), schema)
    expect(schema.form.component).toEqual({ name: 'BookLayout' })
  })

  it('rejects forms with both fields and properties', async () => {
    const schema = {
      type: 'list',
      name: 'books',
      form: {
        type: 'form',
        fields: { title: { type: 'text' } },
        properties: { title: { type: 'string' } }
      }
    }
    await expect(setupForms(createApi(), schema)).rejects.toThrow(
      'Unable to set up the form: It has both `fields` and `properties`.'
    )
  })

  it('rejects forms with unsupported properties', async () => {
    const schema = {
      type: 'object',
      name: 'publisher',
      form: { type: 'form', properties: { name: { type: 'text' } } }
    }
    await expect(setupForms(createApi(), schema)).rejects.toThrow(
      `Unsupported property type: 'text'.`
    )
  })

  it('rejects forms with a component and neither fields nor properties', async () => {
    const schema = {
      type: 'list',
      name: 'books',
      form: { type: 'form', component: { name: 'BookEditor' } }
    }
    await expect(setupForms(createApi(), schema)).rejects.toThrow(
      `Invalid form schema: 'component' needs 'fields' or 'properties'.`
    )
  })

  it('sets up inlined components without storing a form', async () => {
    const api = createApi({ text: { trim: true } })
    const schema = {
      type: 'object',
      fields: { street: { type: 'text' } }
    }
    await setupForms(api, schema)
    expect(schema.fields.street.trim).toBe(true)
    expect(schema.form).toBe(undefined)
  })

  it('leaves `fields()` callbacks to be set up with the data', async () => {
    const api = createApi()
    const fields = vi.fn(() => ({}))
    await setupForms(api, { type: 'section', fields })
    expect(fields).not.toHaveBeenCalled()
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
      fields: {},
      panels: {
        summary: { type: 'panel', fields: { excerpt: { type: 'text' } } }
      }
    }
    await setupSchemaComponents(api, schema)
    expect(schema.panels.summary.fields.excerpt.trim).toBe(true)
  })

  it('sets up the panels of components too', async () => {
    const api = createApi({ text: { trim: true } })
    const schema = {
      type: 'form',
      fields: {
        title: {
          type: 'text',
          panels: {
            hints: { type: 'panel', fields: { hint: { type: 'text' } } }
          }
        }
      }
    }
    await setupSchemaComponents(api, schema)
    expect(schema.fields.title.trim).toBe(true)
    expect(schema.fields.title.panels.hints.fields.hint.trim).toBe(
      true
    )
  })

  it('ignores missing schemas', () => {
    expect(setupSchemaComponents(createApi(), null)).toBe(undefined)
  })
})

describe('setupView()', () => {
  it('sets up the forms of the lists of views', async () => {
    const api = createApi({ text: { trim: true } })
    const books = {
      type: 'view',
      field: {
        type: 'list',
        form: createBookForm()
      }
    }
    await setupView(api, books, 'books')
    expect(books.name).toBe('books')
    expect(books.field.form.fields.title.trim).toBe(true)
  })

  it('resolves the tabs of views', async () => {
    const api = createApi({ text: { trim: true } })
    const dashboard = {
      type: 'view',
      fields: {},
      tabs: {
        stats: Promise.resolve(
          createModule({
            default: { type: 'tab', fields: { total: { type: 'text' } } }
          })
        )
      }
    }
    await setupView(api, dashboard, 'dashboard')
    expect(dashboard.tabs.stats.fields.total.trim).toBe(true)
  })

  it('sets up the items of menus', async () => {
    const api = createApi()
    const catalog = {
      type: 'menu',
      items: {
        bookAuthors: { type: 'view', fields: {} }
      }
    }
    await setupView(api, catalog, 'catalog')
    expect(catalog.name).toBe('catalog')
    expect(catalog.items.bookAuthors.name).toBe('bookAuthors')
  })

  it('rejects schemas that are neither views nor menus', async () => {
    await expect(
      setupView(createApi(), { type: 'form' }, 'books')
    ).rejects.toThrow('Invalid view schema')
  })
})

describe('resolveSchemaComponent()', () => {
  it('resolves custom components as they are', async () => {
    const component = { name: 'BookCover' }
    const schema = {
      type: 'component',
      component: Promise.resolve(createModule({ default: component }))
    }
    await resolveSchemaComponent(schema)
    expect(schema.component).toBe(component)
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

  it('leaves components alone that resolve to nothing', async () => {
    const component = () => null
    const schema = { type: 'component', component }
    await resolveSchemaComponent(schema)
    expect(schema.component).toBe(component)
  })

  it('resolves the components of all schemas, e.g. columns', async () => {
    const columns = {
      cover: { component: async () => ({ name: 'BookCover' }) },
      title: { label: 'Title' }
    }
    await resolveSchemaComponents(columns)
    await resolveSchemaComponents(null)
    expect(columns.cover.component).toEqual({ name: 'BookCover' })
    expect(columns.title).toEqual({ label: 'Title' })
  })

  it('sets up custom components through their type', async () => {
    const api = createApi()
    const form = await setupForm(api, {
      type: 'form',
      fields: {
        cover: { type: 'component', component: { name: 'BookCover' } }
      }
    })
    expect(form.fields.cover.component).toEqual({ name: 'BookCover' })
  })
})
