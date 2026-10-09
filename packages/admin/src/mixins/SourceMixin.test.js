import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  settle,
  stubConfirm,
  unmountAdmin
} from '../test/mount.js'
import { getTypeOptions } from '../utils/schema/types.js'

async function mountBookForm() {
  return mountForm({
    schema: {
      components: {
        chapters: {
          type: 'list',
          inlined: true,
          deletable: true,
          itemLabel: 'title',
          form: {
            type: 'form',
            label: 'Chapter',
            components: { title: { type: 'text' } }
          }
        }
      }
    },
    data: { chapters: [{ title: 'Tom & Jerry <img src=x>' }] }
  })
}

describe('SourceMixin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('deleteItem()', () => {
    it('confirms with the text and notifies with the label', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      const confirm = stubConfirm()
      const { findField, data } = await mountBookForm()
      await findField('chapters').find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(confirm).toHaveBeenCalledWith(
        `Do you really want to remove Chapter 'Tom & Jerry <img src=x>'?`
      )
      expect(data.chapters).toEqual([])
      const notification = document.querySelector('.dito-notification')
      expect(notification.querySelector('img')).toBe(null)
      const paragraphs = [...notification.querySelectorAll('p')].map(
        paragraph => paragraph.textContent
      )
      expect(paragraphs).toEqual([
        `Chapter 'Tom & Jerry <img src=x>' was removed.`,
        'Note: the parent still needs to be saved ' +
        'in order to persist this change.'
      ])
    })

    it('keeps the item when cancelled', async () => {
      const confirm = stubConfirm(false)
      const { findField, data } = await mountBookForm()
      await findField('chapters').find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(confirm).toHaveBeenCalledOnce()
      expect(data.chapters).toEqual([{ title: 'Tom & Jerry <img src=x>' }])
      expect(document.querySelector('.dito-notification')).toBe(null)
    })

    it('removes the confirmed item after the list changed', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      const confirm = stubConfirm()
      const { findField, data } = await mountBookForm()
      // Another item is inserted before it while the dialog is open:
      confirm.mockImplementation(() => {
        data.chapters.unshift({ title: 'Prologue' })
        return true
      })
      await findField('chapters').find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(data.chapters).toEqual([{ title: 'Prologue' }])
    })

    it('keeps an object that was replaced while confirming', async () => {
      const confirm = stubConfirm()
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            address: {
              type: 'object',
              inlined: true,
              deletable: true,
              form: {
                type: 'form',
                components: { street: { type: 'text' } }
              }
            }
          }
        },
        data: { address: { street: 'Main St' } }
      })
      // The object is replaced while the dialog is open:
      confirm.mockImplementation(() => {
        data.address = { street: 'Side St' }
        return true
      })
      await findField('address').find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(data.address).toEqual({ street: 'Side St' })
      expect(document.querySelector('.dito-notification')).toBe(null)
    })
    it('emits `change` without making the form dirty for resources', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      stubConfirm()
      const onChange = vi.fn()
      const requests = []
      const { findField, getComponent, routeComponent } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            reviews: {
              type: 'list',
              resource: { path: 'reviews' },
              deletable: true,
              onChange,
              form: { type: 'form', components: { text: { type: 'text' } } }
            }
          }
        },
        data: { title: 'Orlando' },
        request(options) {
          const { method = 'get' } = options
          requests.push(`${method} ${options.url}`)
          return { data: method === 'get' ? [{ id: 7, text: 'Great' }] : {} }
        }
      })
      await findField('reviews').find('.dito-button--delete').trigger('click')
      await flushPromises()
      expect(requests).toContain('delete /items/1/reviews/7')
      expect(onChange).toHaveBeenCalledOnce()
      expect(getComponent('reviews').isDirty).toBe(false)
      expect(routeComponent.isDirty).toBe(false)
    })
  })

  describe('navigateToComponent()', () => {
    it('completes with the route component navigated to', async () => {
      const { admin, getComponent, routeComponent } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              form: {
                type: 'form',
                components: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { chapters: [{ title: 'Arrakis' }, { title: 'Caladan' }] }
      })
      const chapters = getComponent('chapters')
      // Navigate back and forth, so that route components are replaced:
      await admin.navigate('/items/1/chapters/0')
      await admin.navigate('/items/1')
      await admin.navigate('/items/1/chapters/1')
      await admin.navigate('/items/1')
      const onComplete = vi.fn(([component]) => component)
      const chapterForm = await chapters.navigateToComponent(
        'chapters/1/title',
        onComplete
      )
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/1')
      expect(chapterForm).not.toBe(routeComponent)
      expect(chapterForm.isForm).toBe(true)
      expect(chapterForm.data).toEqual({ title: 'Caladan' })
    })
  })

  describe('defaultSort', () => {
    async function mountBooksView(columns) {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'books' },
              columns
            }
          }
        },
        request: () => ({ data: [{ id: 1, title: 'Emma', year: 1815 }] })
      })
      await admin.navigate('/books')
      const loadQueries = admin.request.mock.calls
        .map(([options]) => options)
        .filter(({ url }) => url === '/books')
        .map(({ query }) => query)
      return { admin, loadQueries }
    }

    it('orders by the first column with `defaultSort` in its direction', async () => {
      const { admin, loadQueries } = await mountBooksView({
        title: { sortable: true },
        year: { sortable: true, defaultSort: 'desc' }
      })
      expect(admin.router.currentRoute.value.query).toEqual({
        order: 'year desc'
      })
      expect(loadQueries).toEqual([{ order: 'year desc' }])
      expect(
        admin.wrapper
          .findAll('.dito-table-head th')
          .map(th => th.attributes('aria-sort'))
      ).toEqual(['none', 'descending'])
    })

    it('orders ascending with `defaultSort: true`', async () => {
      const { admin, loadQueries } = await mountBooksView({
        title: { sortable: true, defaultSort: true },
        year: { sortable: true }
      })
      expect(admin.router.currentRoute.value.query).toEqual({
        order: 'title asc'
      })
      expect(loadQueries).toEqual([{ order: 'title asc' }])
    })
  })

  describe('query', () => {
    async function mountBooksView() {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'books' },
              columns: {
                title: { sortable: true, defaultSort: true }
              }
            }
          }
        },
        request: () => ({ data: [{ id: 1, title: 'Emma' }] })
      })
      await admin.navigate('/books')
      const [source] = admin.wrapper
        .findAllComponents({ name: 'DitoTypeList' })
        .map(({ vm }) => vm)
      const getLoadQueries = () =>
        admin.request.mock.calls
          .map(([options]) => options)
          .filter(({ url }) => url === '/books')
          .map(({ query }) => query)
      return { admin, source, getLoadQueries }
    }

    it('loads the set query once when loading while it navigates', async () => {
      const { admin, source, getLoadQueries } = await mountBooksView()
      const loadCount = getLoadQueries().length
      source.query = { order: 'title desc' }
      source.loadData()
      await flushPromises()
      expect(admin.router.currentRoute.value.query).toEqual({
        order: 'title desc'
      })
      expect(source.query).toEqual({ order: 'title desc' })
      expect(getLoadQueries().slice(loadCount)).toEqual([
        { order: 'title desc' }
      ])
    })

    it('loads the stored query when the navigation fails', async () => {
      const { admin, source, getLoadQueries } = await mountBooksView()
      const loadCount = getLoadQueries().length
      admin.router.beforeEach(() => false)
      source.query = { order: 'title desc' }
      source.loadData()
      await flushPromises()
      expect(source.query).toEqual({ order: 'title asc' })
      expect(getLoadQueries().slice(loadCount)).toEqual([
        { order: 'title asc' }
      ])
    })

    it(`doesn't load once unmounted when the navigation fails`, async () => {
      const { admin, source, getLoadQueries } = await mountBooksView()
      const loadCount = getLoadQueries().length
      let rejectNavigation
      admin.router.beforeEach(
        () => new Promise(resolve => (rejectNavigation = () => resolve(false)))
      )
      source.query = { order: 'title desc' }
      source.loadData()
      await flushPromises()
      unmountAdmin(admin)
      rejectNavigation()
      await flushPromises()
      expect(getLoadQueries().slice(loadCount)).toEqual([])
    })
  })

  describe('processing', () => {
    it('processes the items of lists without forms as copies', async () => {
      // Copying to the clipboard removes the ids of the items, which mustn't
      // remove them from the edited data:
      const { schemaComponent, data } = await mountSchema({
        schema: {
          components: {
            authors: { type: 'list', columns: { name: {} } }
          }
        },
        data: {
          authors: [
            { id: 1, name: 'Mary Shelley' },
            { id: 2, name: 'Bram Stoker' }
          ]
        }
      })
      expect(schemaComponent.getDataForClipboard()).toEqual({
        authors: [{ name: 'Mary Shelley' }, { name: 'Bram Stoker' }]
      })
      expect(data.authors).toEqual([
        { id: 1, name: 'Mary Shelley' },
        { id: 2, name: 'Bram Stoker' }
      ])
    })

    it('processes objects without forms as copies', () => {
      const schema = { type: 'object' }
      const graph = { addSource: vi.fn() }
      const value = { id: 1, name: 'Mary Shelley' }
      const processed = getTypeOptions(schema).processValue(
        { schema, value, dataPath: 'author' },
        graph
      )
      expect(processed).toEqual(value)
      expect(processed).not.toBe(value)
      expect(graph.addSource).toHaveBeenCalledWith('author', schema)
      expect(
        getTypeOptions(schema).processValue(
          { schema, value: null, dataPath: 'author' },
          graph
        )
      ).toBe(null)
    })
  })
  describe('loading data', () => {
    // Unlike `mountSchema()`, doesn't set the data of the view after its
    // sources loaded theirs.
    async function mountView(components, request) {
      const admin = await mountAdmin({
        views: { test: { type: 'view', components } },
        request
      })
      await admin.navigate('/test')
      const view = admin.getRouteComponent(component => component.isView)
      await settle(view)
      return {
        data: view.data,
        getComponent: dataPath =>
          view.mainSchemaComponent.getComponentByDataPath(dataPath)
      }
    }

    it('sets the data of the view from objects that the list loads', async () => {
      // Controllers can send the data of a whole view, including the list:
      const { data } = await mountView(
        {
          books: {
            type: 'list',
            resource: { path: 'books' },
            columns: { title: {} }
          },
          note: { type: 'text' }
        },
        () => ({
          data: { books: [{ id: 1, title: 'Emma' }], note: 'Classics' }
        })
      )
      expect(data.books).toEqual([{ id: 1, title: 'Emma' }])
      expect(data.note).toBe('Classics')
    })

    it('ignores objects that lists in forms load', async () => {
      const { data, getComponent } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            reviews: {
              type: 'list',
              resource: { path: '/reviews' },
              columns: { text: {} }
            }
          }
        },
        data: { title: 'Orlando' },
        request: () => ({ data: { reviews: [{ id: 1, text: 'Great' }] } })
      })
      expect(getComponent('reviews').listData).toEqual([])
      expect(data).toEqual({ id: 1, title: 'Orlando' })
    })

    it('loads objects through the resource of object sources', async () => {
      const { getComponent } = await mountView(
        {
          publisher: {
            type: 'object',
            resource: { path: 'publisher' },
            form: { type: 'form', components: { name: { type: 'text' } } }
          }
        },
        () => ({ data: { id: 1, name: 'Penguin' } })
      )
      const publisher = getComponent('publisher')
      expect(publisher.value).toEqual({ id: 1, name: 'Penguin' })
      expect(publisher.objectData).toEqual({ id: 1, name: 'Penguin' })
    })

    it('clears the value and the total when loading anew', async () => {
      let resolveLoad = null
      let isPending = false
      const { getComponent } = await mountView(
        {
          books: {
            type: 'list',
            resource: { path: 'books' },
            columns: { title: {} }
          }
        },
        () =>
          isPending
            ? new Promise(resolve => (resolveLoad = resolve))
            : { data: { results: [{ id: 1, title: 'Emma' }], total: 12 } }
      )
      const books = getComponent('books')
      expect(books.value).toEqual([{ id: 1, title: 'Emma' }])
      expect(books.total).toBe(12)
      isPending = true
      books.loadData(true)
      await flushPromises()
      expect(books.value).toBe(null)
      expect(books.total).toBe(0)
      resolveLoad({ data: { results: [], total: 0 } })
      await flushPromises()
      expect(books.value).toEqual([])
    })

    it('unwraps list results in the data of the parent', async () => {
      const { getComponent, data } = await mountSchema({
        schema: {
          components: { books: { type: 'list', columns: { title: {} } } }
        },
        data: {
          books: { results: [{ id: 1, title: 'Emma' }], total: 7 }
        }
      })
      expect(data.books).toEqual([{ id: 1, title: 'Emma' }])
      expect(getComponent('books').total).toBe(7)
    })
  })

  describe('scopes', () => {
    it('loads the scope marked as `defaultScope` by default', async () => {
      const request = vi.fn(() => ({ data: [] }))
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              scopes: { all: {}, recent: { defaultScope: true } },
              columns: { title: {} }
            }
          }
        },
        request
      })
      expect(getComponent('books').defaultScope.name).toBe('recent')
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/books', query: { scope: 'recent' } })
      )
    })

    it('defaults to the first scope', async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            books: {
              type: 'list',
              scopes: { all: {}, recent: {} },
              columns: { title: {} }
            }
          }
        }
      })
      expect(getComponent('books').defaultScope.name).toBe('all')
    })
  })

  describe('wrapPrimitives', () => {
    it('edits primitive values through wrapped items', async () => {
      const { getComponent, data, settle } = await mountSchema({
        schema: {
          components: {
            tags: {
              type: 'list',
              inlined: true,
              wrapPrimitives: 'tag',
              form: { type: 'form', components: { tag: { type: 'text' } } }
            }
          }
        },
        data: { tags: ['fiction', 'classic'] }
      })
      const tags = getComponent('tags')
      expect(tags.listData).toEqual([{ tag: 'fiction' }, { tag: 'classic' }])
      const item = tags.createItem(tags.schema.form)
      item.tag = 'romance'
      await settle()
      expect(tags.wrappedPrimitives).toHaveLength(3)
      expect(data.tags).toEqual(['fiction', 'classic', 'romance'])
    })
  })

  describe('createItem()', () => {
    it('inserts items at the index and opens collapsible ones', async () => {
      const { getComponent, data, settle } = await mountSchema({
        schema: {
          components: {
            chapters: {
              type: 'list',
              inlined: true,
              collapsible: true,
              collapsed: true,
              form: { type: 'form', components: { title: { type: 'text' } } }
            }
          }
        },
        data: { chapters: [{ title: 'One' }, { title: 'Three' }] }
      })
      const chapters = getComponent('chapters')
      const item = chapters.createItem(chapters.schema.form, null, 1)
      item.title = 'Two'
      await settle()
      expect(data.chapters.map(({ title }) => title)).toEqual([
        'One',
        'Two',
        'Three'
      ])
      const schemaComponent = chapters.getSchemaComponent(1)
      expect(schemaComponent.data).toBe(chapters.listData[1])
      expect(schemaComponent.opened).toBe(true)
      expect(chapters.getSchemaComponent(0).opened).toBe(false)
    })
  })

  describe('createItem() at the end', () => {
    it('opens the appended item of collapsible lists', async () => {
      const { getComponent, settle } = await mountSchema({
        schema: {
          components: {
            chapters: {
              type: 'list',
              inlined: true,
              collapsible: true,
              collapsed: true,
              form: { type: 'form', components: { title: { type: 'text' } } }
            }
          }
        },
        data: { chapters: [{ title: 'One' }] }
      })
      const chapters = getComponent('chapters')
      chapters.createItem(chapters.schema.form)
      await settle()
      expect(chapters.listData).toHaveLength(2)
      expect(chapters.getSchemaComponent(1).opened).toBe(true)
      expect(chapters.getSchemaComponent(0).opened).toBe(false)
    })
  })

  describe('getSchemaComponent()', () => {
    it('returns nothing for empty lists and missing items', async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            chapters: {
              type: 'list',
              inlined: true,
              form: { type: 'form', components: { title: { type: 'text' } } }
            },
            prologue: {
              type: 'list',
              inlined: true,
              form: { type: 'form', components: { title: { type: 'text' } } }
            }
          }
        },
        data: { chapters: [{ title: 'One' }], prologue: [] }
      })
      expect(getComponent('chapters').getSchemaComponent(5)).toBe(null)
      expect(getComponent('prologue').getSchemaComponent(0)).toBe(undefined)
    })
  })

  describe('deleteItem() with resources', () => {
    const mountReviews = (reviews, request = null) =>
      mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            reviews: {
              type: 'list',
              resource: { path: 'reviews' },
              deletable: true,
              form: { type: 'form', components: { text: { type: 'text' } } }
            }
          }
        },
        data: { title: 'Orlando' },
        request: options => {
          const { method = 'get' } = options
          request?.(options)
          return { data: method === 'get' ? reviews : {} }
        }
      })

    const getDeleteRequests = request =>
      request.mock.calls.filter(([{ method }]) => method === 'delete')

    it('ignores missing items', async () => {
      const { getComponent, request } = await mountReviews([])
      await getComponent('reviews').deleteItem(null, 0)
      expect(getDeleteRequests(request)).toEqual([])
    })

    it(`doesn't delete items removed while confirming`, async () => {
      const confirm = stubConfirm()
      const { getComponent, request } = await mountReviews([
        { id: 7, text: 'Great' }
      ])
      const reviews = getComponent('reviews')
      const [item] = reviews.listData
      confirm.mockImplementation(() => {
        reviews.listData = []
        return true
      })
      await reviews.deleteItem(item, 0)
      await flushPromises()
      expect(getDeleteRequests(request)).toEqual([])
    })

    it(`doesn't delete items without ids through the resource`, async () => {
      stubConfirm()
      const { getComponent, request } = await mountReviews([{ text: 'New' }])
      const reviews = getComponent('reviews')
      await reviews.deleteItem(reviews.listData[0], 0)
      await flushPromises()
      expect(getDeleteRequests(request)).toEqual([])
      expect(reviews.listData).toEqual([{ text: 'New' }])
    })
  })

  describe('navigateToComponent() outside the source', () => {
    it(`doesn't reveal data paths of other components`, async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            chapters: {
              type: 'list',
              inlined: true,
              form: { type: 'form', components: { title: { type: 'text' } } }
            }
          }
        },
        data: { chapters: [{ title: 'One' }] }
      })
      expect(
        await getComponent('chapters').navigateToComponent('authors/0', null, {
          shouldRevealInlinedOnly: true
        })
      ).toBe(false)
    })
  })

  describe('navigateToRouteComponent()', () => {
    const mountChapters = () =>
      mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              form: {
                type: 'form',
                components: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { chapters: [{ title: 'Arrakis' }] }
      })

    it('completes right away when already at the route', async () => {
      const { admin, getComponent } = await mountChapters()
      const chapters = getComponent('chapters')
      await admin.navigate('/items/1/chapters/0')
      const routeComponent = admin.getRouteComponent()
      const onComplete = vi.fn(([component]) => component)
      expect(
        await chapters.navigateToRouteComponent('chapters/0', onComplete)
      ).toBe(routeComponent)
      expect(onComplete).toHaveBeenCalledOnce()
      // Without `onComplete()`, it resolves to `true`:
      expect(await chapters.navigateToRouteComponent('chapters/0')).toBe(true)
    })

    it('resolves to false without a route for the data path', async () => {
      const { getComponent } = await mountChapters()
      const onComplete = vi.fn()
      expect(
        await getComponent('chapters').navigateToRouteComponent(
          'unknown/path',
          onComplete
        )
      ).toBe(false)
      expect(onComplete).not.toHaveBeenCalled()
    })
  })

  describe('forms', () => {
    it('tells whether all forms are compact', async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            authors: {
              type: 'list',
              inlined: true,
              form: {
                type: 'form',
                compact: true,
                components: { name: { type: 'text' } }
              }
            },
            books: {
              type: 'list',
              inlined: true,
              forms: {
                novel: { type: 'form', compact: true, components: {} },
                poem: { type: 'form', components: {} }
              }
            }
          }
        }
      })
      expect(getComponent('authors').forms).toHaveLength(1)
      expect(getComponent('authors').isCompact).toBe(true)
      expect(getComponent('books').forms).toHaveLength(2)
      expect(getComponent('books').isCompact).toBe(false)
    })
  })

  describe('processSchema()', () => {
    const api = { normalizePath: path => path }

    it('refuses resources of inlined lists', async () => {
      const schema = {
        type: 'list',
        inlined: true,
        resource: { path: 'books' },
        form: { type: 'form', components: {} }
      }
      await expect(
        getTypeOptions(schema).processSchema(api, schema, 'books', [], 0)
      ).rejects.toThrow('Nested lists cannot load data from their own')
    })

    it('refuses resources of inlined objects', async () => {
      const schema = {
        type: 'object',
        inlined: true,
        resource: { path: 'publisher' },
        form: { type: 'form', components: {} }
      }
      await expect(
        getTypeOptions(schema).processSchema(api, schema, 'publisher', [], 0)
      ).rejects.toThrow('Nested objects cannot load data from their own')
    })
  })
})
