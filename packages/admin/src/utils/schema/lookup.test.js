import { vi } from 'vitest'
import { reactive } from 'vue'
import { hyphenate } from '@ditojs/utils'
import SchemaContext from '../../SchemaContext.js'
import { defineType } from './types.ts'
import {
  getAllPanelEntries,
  getPanelEntries,
  hasFormSchema,
  hasMultipleFormSchemas,
  getViewFormSchema,
  getViewSchema,
  hasViewSchema,
  getFormSchemas,
  getItemFormSchemaFromForms,
  getItemFormSchema,
  isEmptySchema,
  getNamedSchemas,
  getButtonSchemas
} from './lookup.js'

// Define minimal types, as the actual type components can't be
// imported without a Vue SFC compiler:
defineType({
  type: 'panel',
  defaultNested: false,
  getPanelSchema: (api, schema) => schema
})
defineType({
  type: 'list',
  sourceType: 'list',
  getPanelSchema: () => ({ type: 'panel', name: '$filters' })
})
defineType({ type: 'object', sourceType: 'object' })
defineType({ type: 'section', defaultNested: false })
defineType({ type: 'text' })

describe('getAllPanelEntries()', () => {
  const getPaths = entries =>
    entries.map(({ dataPath, componentPath }) => ({ dataPath, componentPath }))

  it('adds the names of panel components once to their paths', () => {
    // Unnested components add their name to their component path, but not to
    // their data path, so the panel is addressed relative to the data path.
    const links = { type: 'panel', name: 'links' }
    expect(
      getPaths(getAllPanelEntries(null, links, 'book', 'main', 'main/links'))
    ).toEqual([{ dataPath: 'book/links', componentPath: 'main/links' }])
  })

  it('continues the paths of nested components for type panels', () => {
    const books = { type: 'list', name: 'books' }
    expect(
      getPaths(
        getAllPanelEntries(
          null,
          books,
          'shelf/books',
          'main/books',
          'main/books'
        )
      )
    ).toEqual([
      {
        dataPath: 'shelf/books/$filters',
        componentPath: 'main/books/$filters'
      }
    ])
  })

  it('continues the component path of components for their panels', () => {
    const section = {
      type: 'section',
      name: 'section',
      panels: { info: { type: 'panel' } }
    }
    expect(
      getPaths(
        getAllPanelEntries(null, section, 'book', 'main', 'main/section')
      )
    ).toEqual([{ dataPath: 'book/info', componentPath: 'main/section/info' }])
  })

  it('addresses the panels of `schema.panels` by their keys only', () => {
    // Panels can carry their names too, e.g. when resolved from modules.
    const section = {
      type: 'section',
      name: 'section',
      panels: { info: { type: 'panel', name: 'info' } }
    }
    expect(
      getPaths(
        getAllPanelEntries(null, section, 'book', 'main', 'main/section')
      )
    ).toEqual([{ dataPath: 'book/info', componentPath: 'main/section/info' }])
  })
})

describe('getPanelEntries()', () => {
  it('returns entries for panels, skipping missing ones', () => {
    const info = { type: 'panel' }
    expect(getPanelEntries({ info, missing: null }, 'book', 'main')).toEqual([
      {
        schema: info,
        dataPath: 'book/info',
        componentPath: 'main/info',
        tabName: null,
        isTabSelected: null
      }
    ])
    expect(getPanelEntries(null, 'book', 'main')).toEqual([])
  })

  it('describes the tab of panels with data only', () => {
    const isTabSelected = () => true
    const [entry] = getPanelEntries(
      { info: { type: 'panel' } },
      'book',
      'main',
      { tabName: 'details', isTabSelected }
    )
    expect(entry).toMatchObject({ tabName: 'details', isTabSelected })
  })
})

describe('hasFormSchema() and hasMultipleFormSchemas()', () => {
  const form = { type: 'form', fields: {} }

  it('tell schemas with forms, inlined or created components apart', () => {
    expect(hasFormSchema({ type: 'list', form })).toBe(true)
    expect(hasFormSchema({ type: 'list', forms: { book: form } })).toBe(true)
    expect(hasFormSchema({ type: 'object', fields: {} })).toBe(true)
    expect(hasFormSchema({ type: 'section', fields: () => ({}) })).toBe(
      true
    )
    expect(hasFormSchema({ type: 'text' })).toBe(false)
    expect(hasFormSchema({ form })).toBe(false)
  })

  it('tell schemas with more than one form apart', () => {
    expect(
      hasMultipleFormSchemas({
        type: 'list',
        forms: { novel: form, comic: form }
      })
    ).toBe(true)
    expect(
      hasMultipleFormSchemas({ type: 'list', forms: { novel: form } })
    ).toBe(
      false
    )
    expect(hasMultipleFormSchemas({ type: 'list', form })).toBe(false)
    expect(hasMultipleFormSchemas(null)).toBe(false)
  })
})

describe('view lookups', () => {
  // Lists that edit their items in the forms of other views, e.g. the books of
  // an author that are edited in the view of all books:
  const bookForm = { type: 'form', fields: { title: { type: 'text' } } }
  const books = {
    type: 'view',
    path: 'books',
    field: { type: 'list', form: bookForm }
  }
  const dashboard = {
    type: 'view',
    path: 'dashboard',
    tabs: {
      stats: {
        type: 'tab',
        fields: {
          summary: { type: 'text' },
          authors: { type: 'list', form: bookForm }
        }
      }
    }
  }
  const empty = { type: 'view', fields: {} }
  const context = { flattenedViews: { books, dashboard, empty } }

  it('find the component with a form of views, also in their tabs', () => {
    expect(getViewFormSchema({ view: 'books' }, context)).toBe(books.field)
    expect(getViewFormSchema({ view: 'dashboard' }, context)).toBe(
      dashboard.tabs.stats.fields.authors
    )
    expect(getViewFormSchema({ view: 'empty' }, context)).toBe(null)
    expect(getViewFormSchema({ view: 'unknown' }, context)).toBe(null)
    expect(getViewFormSchema({}, context)).toBe(null)
  })

  it('return the views with forms', () => {
    expect(getViewSchema({ view: 'books' }, context)).toBe(books)
    expect(getViewSchema({ view: 'empty' }, context)).toBe(null)
    expect(hasViewSchema({ view: 'dashboard' }, context)).toBe(true)
    expect(hasViewSchema({ view: 'empty' }, context)).toBe(false)
  })

  it('return the forms of views for lists that use them', () => {
    expect(getFormSchemas({ type: 'list', view: 'books' }, context)).toEqual({
      default: bookForm
    })
    expect(() => getFormSchemas({ type: 'list', view: 'unknown' }, context))
      .toThrow(`Unknown view: 'unknown'`)
  })
})

describe('getFormSchemas()', () => {
  const novel = { type: 'form', fields: { title: { type: 'text' } } }
  const comic = { type: 'form', fields: { artist: { type: 'text' } } }

  it('returns `forms`, or `form` as the default form', () => {
    expect(getFormSchemas({ type: 'list', forms: { novel, comic } })).toEqual({
      novel,
      comic
    })
    expect(getFormSchemas({ type: 'list', form: novel })).toEqual({
      default: novel
    })
  })

  it('converts inlined components and tabs to forms', () => {
    const fields = { street: { type: 'text' } }
    const tabs = { notes: { type: 'tab' } }
    expect(
      getFormSchemas({
        type: 'object',
        name: 'address',
        compact: true,
        fields,
        tabs
      })
    ).toEqual({
      default: {
        type: 'form',
        name: 'address',
        compact: true,
        tabs,
        fields
      }
    })
  })

  it('passes the clipboard of objects to their form, not of lists', () => {
    const fields = { title: { type: 'text' } }
    expect(
      getFormSchemas({ type: 'object', clipboard: true, form: novel })
    ).toEqual({ default: { ...novel, clipboard: true } })
    expect(
      getFormSchemas({ type: 'object', clipboard: true, fields })
    ).toEqual({ default: { type: 'form', clipboard: true, fields } })
    expect(
      getFormSchemas({ type: 'list', clipboard: true, forms: { novel } })
    ).toEqual({ novel })
    expect(
      getFormSchemas({ type: 'list', clipboard: true, fields })
    ).toEqual({ default: { type: 'form', fields } })
  })

  it('returns the same derived forms each time', () => {
    // Items render again whenever their form changes:
    const list = { type: 'list', fields: { title: { type: 'text' } } }
    expect(getFormSchemas(list).default).toBe(getFormSchemas(list).default)
    const object = { type: 'object', clipboard: true, form: novel }
    expect(getFormSchemas(object).default).toBe(getFormSchemas(object).default)
  })

  it('returns no forms for schemas without forms', () => {
    expect(getFormSchemas({ type: 'text' })).toEqual({})
  })

  it('lets `modifyForm()` replace the forms', () => {
    const forms = getFormSchemas(
      { type: 'list', forms: { novel, comic } },
      null,
      form => (form === novel ? { ...form, compact: true } : undefined)
    )
    expect(forms.novel).toEqual({ ...novel, compact: true })
    expect(forms.comic).toBe(comic)
  })

  describe('with `fields()` callbacks', () => {
    // E.g. the fields of an item that depend on its selected template:
    const createComponents = vi.fn(({ item }) =>
      Object.fromEntries(
        (item?.fields ?? []).map(name => [name, { type: 'text' }])
      )
    )
    const schema = { type: 'section', fields: createComponents }
    const api = { defaults: {}, normalizePath: hyphenate }
    const createContext = data => new SchemaContext(null, { api, data })

    beforeEach(() => {
      createComponents.mockClear()
    })

    it('creates the components for the data of the context', () => {
      const item = { fields: ['title', 'author'] }
      const { default: form } = getFormSchemas(schema, createContext(item))
      expect(Object.keys(form.fields)).toEqual(['title', 'author'])
      expect(createComponents).toHaveBeenCalledTimes(1)
    })

    it('shares the created forms per callback and data', () => {
      const item = { fields: ['title'] }
      const forms1 = getFormSchemas(schema, createContext(item))
      const forms2 = getFormSchemas(schema, createContext(item))
      expect(forms1.default).toBe(forms2.default)
      expect(createComponents).toHaveBeenCalledTimes(1)
      const forms3 = getFormSchemas(schema, createContext({ fields: [] }))
      expect(forms3.default).not.toBe(forms1.default)
    })

    it('recreates the components with the latest context', () => {
      const item = reactive({ fields: ['title'] })
      const firstContext = createContext(item)
      const latestContext = createContext(item)
      getFormSchemas(schema, firstContext)
      expect(createComponents.mock.lastCall[0]).toBe(firstContext)
      item.fields.push('author')
      const { default: form } = getFormSchemas(schema, latestContext)
      expect(Object.keys(form.fields)).toEqual(['title', 'author'])
      expect(createComponents).toHaveBeenCalledTimes(2)
      expect(createComponents.mock.lastCall[0]).toBe(latestContext)
    })

    it(`creates the components each time for data that isn't an object`, () => {
      const forms1 = getFormSchemas(schema, createContext(null))
      const forms2 = getFormSchemas(schema, createContext(null))
      expect(forms1.default.fields).toEqual({})
      expect(forms1.default).not.toBe(forms2.default)
      expect(createComponents).toHaveBeenCalledTimes(2)
    })

    it('leaves the callbacks alone without a context', () => {
      const { default: form } = getFormSchemas(schema)
      expect(form.fields).toBe(createComponents)
      expect(createComponents).not.toHaveBeenCalled()
    })
  })
})

describe('getItemFormSchema()', () => {
  const novel = { type: 'form', fields: {} }
  const fallback = { type: 'form', fields: {} }

  it('picks the form by the type of the item, or the default form', () => {
    const forms = { novel, default: fallback }
    expect(getItemFormSchemaFromForms(forms, { type: 'novel' })).toBe(novel)
    expect(getItemFormSchemaFromForms(forms, { type: 'comic' })).toBe(fallback)
    expect(getItemFormSchemaFromForms({ novel }, null)).toBe(null)
  })

  it('returns the empty schema when there is no form', () => {
    const list = { type: 'list', forms: { novel } }
    expect(getItemFormSchema(list, { type: 'novel' })).toBe(novel)
    const schema = getItemFormSchema(list, { type: 'comic' })
    expect(schema).toEqual({})
    expect(isEmptySchema(schema)).toBe(true)
    expect(isEmptySchema({})).toBe(false)
  })
})

describe('getNamedSchemas()', () => {
  it('names the schemas of objects after their keys', () => {
    expect(
      getNamedSchemas({
        title: { label: 'Book Title' },
        author: 'Written By',
        ignored: true
      })
    ).toEqual({
      title: { name: 'title', label: 'Book Title' },
      author: { name: 'author', label: 'Written By' }
    })
  })

  it('keeps the names of schemas in arrays, and names strings', () => {
    expect(
      getNamedSchemas([{ name: 'title', label: 'Title' }, 'published-at'])
    ).toEqual({
      title: { name: 'title', label: 'Title' },
      publishedAt: { name: 'publishedAt' }
    })
  })

  it('applies the defaults, which the schemas override', () => {
    expect(
      getNamedSchemas({ save: { type: 'submit' }, cancel: {} }, { type: 'x' })
    ).toEqual({
      save: { type: 'submit', name: 'save' },
      cancel: { type: 'x', name: 'cancel' }
    })
  })

  it('returns `null` for empty and missing schemas', () => {
    expect(getNamedSchemas([])).toBe(null)
    expect(getNamedSchemas({})).toBe(null)
    expect(getNamedSchemas(null)).toBe(null)
  })

  it('makes buttons of button schemas by default', () => {
    expect(getButtonSchemas({ archive: { label: 'Archive' } })).toEqual({
      archive: { type: 'button', name: 'archive', label: 'Archive' }
    })
  })
})
