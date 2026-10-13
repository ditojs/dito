import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  settle,
  stubConfirm,
  unmountAdmin,
  isView,
  isForm
} from '../test/mount.js'
import DitoTypeList from '../types/DitoTypeList.vue'
import { getTypeDescriptor } from '../utils/schema/types.ts'

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

// Whether the inlined items of the source are opened:
function getOpenedItems(source) {
  return [...source.$el.querySelectorAll('.dito-schema-inlined')].map(
    element => element.classList.contains('dito-schema--open')
  )
}

describe('useSource()', () => {
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
      const { findField, routeComponent } = await mountForm({
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
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('stays clean when deleting through resources sent with the data', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      stubConfirm()
      const { findField, routeComponent } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            reviews: {
              type: 'list',
              resource: { path: 'reviews' },
              exclude: false,
              deletable: true,
              form: { type: 'form', components: { text: { type: 'text' } } }
            }
          }
        },
        data: { title: 'Orlando' },
        request: ({ method = 'get' }) => ({
          data: method === 'get' ? [{ id: 7, text: 'Great' }] : {}
        })
      })
      await findField('reviews').find('.dito-button--delete').trigger('click')
      await flushPromises()
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('keeps the edits of the source when deleting through it', async () => {
      stubConfirm()
      // The list loads again after the deletion, which we hold back:
      let reload = null
      const { findField, data, routeComponent } = await mountForm({
        schema: {
          components: {
            reviews: {
              type: 'list',
              resource: { path: 'reviews' },
              deletable: true,
              form: { type: 'form', components: { text: { type: 'text' } } },
              buttons: { save: { type: 'submit' } }
            }
          }
        },
        data: {},
        request: ({ method = 'get' }) =>
          method === 'delete'
            ? { data: {} }
            : (reload?.promise ?? {
                data: [
                  { id: 7, text: 'Great' },
                  { id: 8, text: 'Fine' }
                ]
              })
      })
      const { model } = routeComponent.dataContext
      const [, review] = data.reviews
      model.set(
        { data: review, name: 'text', dataPath: 'reviews/1/text' },
        'Superb'
      )
      expect(routeComponent.routeContext.isDirty).toBe(true)
      reload = Promise.withResolvers()
      await findField('reviews').find('.dito-button--delete').trigger('click')
      await flushPromises()
      expect(data.reviews).toEqual([{ id: 8, text: 'Superb' }])
      expect(routeComponent.routeContext.isDirty).toBe(true)
      reload.resolve({ data: data.reviews })
      await flushPromises()
    })

    it('numbers the items left after deleting one through the resource', async () => {
      stubConfirm()
      // The list loads again after the deletion, which we hold back:
      let reload = null
      const { findField, data, routeComponent } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            reviews: {
              type: 'list',
              resource: { path: 'reviews' },
              deletable: true,
              orderKey: 'position',
              form: { type: 'form', components: { text: { type: 'text' } } }
            }
          }
        },
        data: { title: 'Orlando' },
        request: ({ method = 'get' }) =>
          method === 'delete'
            ? { data: {} }
            : (reload?.promise ?? {
                data: [
                  { id: 7, text: 'Great' },
                  { id: 8, text: 'Fine' }
                ]
              })
      })
      reload = Promise.withResolvers()
      await findField('reviews').find('.dito-button--delete').trigger('click')
      await flushPromises()
      expect(data.reviews).toEqual([{ id: 8, text: 'Fine', position: 0 }])
      expect(routeComponent.dataContext.model.isEdited).toBe(false)
      reload.resolve({ data: data.reviews })
      await flushPromises()
    })

    it('removes objects deleted through their resource, staying clean', async () => {
      stubConfirm()
      let review = { id: 7, text: 'Great' }
      const { findField, data, routeComponent } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            review: {
              type: 'object',
              resource: { path: 'review' },
              deletable: true,
              form: { type: 'form', components: { text: { type: 'text' } } }
            }
          }
        },
        data: { title: 'Orlando' },
        request: ({ method = 'get' }) => {
          if (method === 'delete') {
            review = null
          }
          return { data: method === 'get' ? review : {} }
        }
      })
      await findField('review').find('.dito-button--delete').trigger('click')
      await flushPromises()
      expect(data.review).toBe(null)
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })
  })

  it('waits for pending loads before submitting through its buttons', async () => {
    const admin = await mountAdmin({
      views: {
        books: {
          type: 'view',
          component: {
            type: 'list',
            resource: { path: 'books' },
            columns: { title: {} },
            buttons: {
              saveOrder: {
                type: 'submit',
                resource: { path: 'order', method: 'post' }
              }
            }
          }
        }
      },
      request: ({ method = 'get', data }) =>
        method === 'get' ? { data: [{ id: 1, title: 'Dune' }] } : { data }
    })
    await admin.navigate('/books')
    const view = admin.getRouteComponent(isView)
    // E.g. a running upload:
    const upload = Promise.withResolvers()
    const { model } = view.dataContext
    model.trackPendingLoad(upload.promise)
    await admin.wrapper.find('button[id$="saveOrder"]').trigger('click')
    await flushPromises()
    const isPosted = () =>
      admin.request.mock.calls.some(([{ method }]) => method === 'post')
    expect(isPosted()).toBe(false)
    upload.resolve()
    await settle(view)
    expect(isPosted()).toBe(true)
    unmountAdmin(admin)
  })

  describe('errors of items in forms of nested routes', () => {
    it('open the form of their item', async () => {
      const { admin, routeComponent } = await mountForm({
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
      // Navigate back and forth, so that route components are replaced:
      await admin.navigate('/items/1/chapters/0')
      await admin.navigate('/items/1')
      await admin.navigate('/items/1/chapters/1')
      await admin.navigate('/items/1')
      await routeComponent.dataContext.showValidationErrors({
        'chapters/1/title': [{ message: 'is taken' }]
      })
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/1')
      const chapterForm = admin.getRouteComponent(isForm)
      expect(chapterForm).not.toBe(routeComponent)
      expect(chapterForm.data).toEqual({ title: 'Caladan' })
      const { model } = chapterForm.dataContext
      expect(model.getErrors('chapters/1/title')).toEqual([
        { message: 'is taken' }
      ])
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
        .findAllComponents(DitoTypeList)
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
      source.listQuery.update({ order: 'title desc' })
      source.sourceContext.reload()
      await flushPromises()
      expect(admin.router.currentRoute.value.query).toEqual({
        order: 'title desc'
      })
      expect(source.listQuery.query).toEqual({ order: 'title desc' })
      expect(getLoadQueries().slice(loadCount)).toEqual([
        { order: 'title desc' }
      ])
    })

    it('loads the stored query when the navigation fails', async () => {
      const { admin, source, getLoadQueries } = await mountBooksView()
      const loadCount = getLoadQueries().length
      admin.router.beforeEach(() => false)
      source.listQuery.update({ order: 'title desc' })
      source.sourceContext.reload()
      await flushPromises()
      expect(source.listQuery.query).toEqual({ order: 'title asc' })
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
      source.listQuery.update({ order: 'title desc' })
      source.sourceContext.reload()
      await flushPromises()
      unmountAdmin(admin)
      rejectNavigation()
      await flushPromises()
      expect(getLoadQueries().slice(loadCount)).toEqual([])
    })
  })

  describe('serializing', () => {
    it('serializes the items of lists without forms as copies', async () => {
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
      expect(schemaComponent.getClipboardData()).toEqual({
        authors: [{ name: 'Mary Shelley' }, { name: 'Bram Stoker' }]
      })
      expect(data.authors).toEqual([
        { id: 1, name: 'Mary Shelley' },
        { id: 2, name: 'Bram Stoker' }
      ])
    })

    it('serializes objects without forms as copies', () => {
      const schema = { type: 'object' }
      const { serializeValue } = getTypeDescriptor(schema)
      const value = { id: 1, name: 'Mary Shelley' }
      const serialized = serializeValue({ schema, value })
      expect(serialized).toEqual(value)
      expect(serialized).not.toBe(value)
      expect(serializeValue({ schema, value: null })).toBe(null)
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
      const view = admin.getRouteComponent(isView)
      await settle(view)
      return {
        data: view.data,
        getComponent: dataPath => admin.getComponent(view, dataPath)
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

    describe('deserializing', () => {
      // Stored as a list, edited as text:
      const tags = {
        type: 'text',
        deserializeValue: ({ value }) => value.join(', ')
      }
      const books = {
        type: 'list',
        resource: { path: 'books' },
        form: { type: 'form', components: { tags } }
      }

      it('deserializes the items that it loads', async () => {
        const { data } = await mountView({ books }, () => ({
          data: [{ id: 1, tags: ['novel'] }]
        }))
        expect(data.books).toEqual([{ id: 1, tags: 'novel' }])
      })

      it('deserializes the data of the view that it loads', async () => {
        const { data } = await mountView({ books, tags }, () => ({
          data: { books: [{ id: 1, tags: ['novel'] }], tags: ['classics'] }
        }))
        expect(data.books).toEqual([{ id: 1, tags: 'novel' }])
        expect(data.tags).toBe('classics')
      })
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

    it('loads its list again after an item was saved in its form', async () => {
      const requests = []
      const { admin } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            reviews: {
              type: 'list',
              resource: { path: 'reviews' },
              editable: true,
              form: { type: 'form', components: { text: { type: 'text' } } }
            }
          }
        },
        data: { title: 'Orlando' },
        request({ method = 'get', url, data }) {
          requests.push(`${method} ${url}`)
          return { data: method === 'get' ? [{ id: 7, text: 'Great' }] : data }
        }
      })
      await admin.navigate('/items/1/reviews/7')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      requests.length = 0
      form.$el.querySelector('.dito-buttons--main [type="submit"]').click()
      await settle(form)
      expect(requests).toEqual([
        'patch /items/1/reviews/7', 'get /items/1/reviews'
      ])
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
      expect(getComponent('books').listQuery.query.scope).toBe('recent')
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
      expect(getComponent('books').listQuery.query.scope).toBe('all')
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
      const item = tags.sourceContext.createItem(tags.schema.form)
      item.tag = 'romance'
      await settle()
      expect(tags.listData).toHaveLength(3)
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
      const { sourceContext, schema } = chapters
      const item = sourceContext.createItem(schema.form, null, 1)
      item.title = 'Two'
      await settle()
      expect(data.chapters.map(({ title }) => title)).toEqual([
        'One',
        'Two',
        'Three'
      ])
      expect(getOpenedItems(chapters)).toEqual([false, true, false])
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
      chapters.sourceContext.createItem(chapters.schema.form)
      await settle()
      expect(getOpenedItems(chapters)).toEqual([false, true])
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

  describe('routes', () => {
    const createChapterForm = () => ({
      type: 'form',
      components: { title: { type: 'text' } }
    })

    const createChaptersSchema = (schema = {}) => ({
      type: 'list',
      editable: true,
      form: createChapterForm(),
      ...schema
    })

    const chapters = [{ title: 'Prologue' }, { title: 'Epilogue' }]

    // Mounts the `test` view with the properties of `viewSchema` next to the
    // other `views`, and sets its `data`. Returns the admin and the view.
    async function mountView(viewSchema, data, { views, ...options } = {}) {
      const admin = await mountAdmin({
        views: { ...views, test: { type: 'view', ...viewSchema } },
        ...options
      })
      await admin.navigate('/test')
      const view = admin.getRouteComponent(isView)
      view.dataContext.resetItem(data)
      await settle(view)
      return { admin, view }
    }

    // Navigates to `path` and returns the data of the form that opens there,
    // or `undefined` without a form.
    async function getFormData(admin, path) {
      await admin.navigate(path)
      const form = admin.getRouteComponent(isForm)
      if (form) await settle(form)
      return form?.data
    }

    it('links the items of lists with resources in inlined objects by id', async () => {
      const reviews = [
        { id: 7, title: 'Early' },
        { id: 9, title: 'Late' }
      ]
      const { admin, findField, settle } = await mountForm({
        schema: {
          components: {
            meta: {
              type: 'object',
              components: {
                reviews: {
                  type: 'list',
                  resource: { path: 'reviews' },
                  editable: true,
                  form: {
                    type: 'form',
                    components: { title: { type: 'text' } }
                  }
                }
              }
            }
          }
        },
        data: { title: 'Emma', meta: {} },
        request: ({ url }) => ({
          data: url.endsWith('/9')
            ? reviews[1]
            : url.endsWith('/reviews')
              ? reviews
              : null
        })
      })
      await findField('meta')
        .findAll('.dito-button--edit')[1]
        .trigger('click')
      await settle()
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/meta/reviews/9'
      )
      const form = admin.getRouteComponent(
        it => isForm(it) && it.routeContext.path.endsWith('/9')
      )
      expect(form.data).toEqual({ id: 9, title: 'Late' })
    })

    it('stops forms that contain themselves at their `maxDepth`', async () => {
      const categoryForm = {
        type: 'form',
        components: { name: { type: 'text' } }
      }
      categoryForm.components.subcategories = {
        type: 'list',
        editable: true,
        maxDepth: 2,
        form: categoryForm
      }
      const category = {
        id: 1,
        name: 'Food',
        subcategories: [
          { name: 'Fruit', subcategories: [{ name: 'Apples' }] }
        ]
      }
      const admin = await mountAdmin({
        views: {
          categories: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'categories' },
              form: categoryForm
            }
          }
        },
        request: ({ url }) => ({
          data: url === '/categories/1' ? category : [category]
        })
      })
      const getFormLists = async path => {
        await admin.navigate(path)
        const form = admin.getRouteComponent(isForm)
        await settle(form)
        return form.$el.querySelectorAll('.dito-list').length
      }
      expect(await getFormLists('/categories/1/subcategories/0')).toBe(1)
      expect(
        await getFormLists('/categories/1/subcategories/0/subcategories/0')
      ).toBe(0)
    })

    it('renders the lists in inlined objects without routes', async () => {
      const { admin } = await mountForm({
        schema: {
          components: {
            meta: {
              type: 'object',
              components: { notes: { type: 'list', itemLabel: 'text' } }
            }
          }
        },
        data: { meta: { notes: [{ text: 'Late' }] } }
      })
      expect(admin.wrapper.find('.dito-list').text()).toContain('Late')
    })

    it('adds the nested routes of forms shared by several lists', async () => {
      const bookForm = {
        type: 'form',
        components: { chapters: createChaptersSchema() }
      }
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'books' },
              form: bookForm
            }
          },
          drafts: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'drafts' },
              form: bookForm
            }
          }
        }
      })
      const getRoutePaths = view =>
        admin.router
          .getRoutes()
          .map(route => route.path)
          .filter(path => path.startsWith(`/${view}/`))
          .map(path => path.replace(/:\w+/g, ':id'))
          .sort()
      expect(getRoutePaths('books')).toEqual([
        '/books/:id',
        '/books/:id/chapters',
        '/books/:id/chapters/:id'
      ])
      expect(getRoutePaths('drafts')).toEqual([
        '/drafts/:id',
        '/drafts/:id/chapters',
        '/drafts/:id/chapters/:id'
      ])
    })

    it('opens the forms of items of lists with a `path`', async () => {
      const { admin } = await mountView(
        { components: { chapters: createChaptersSchema({ path: 'parts' }) } },
        { chapters }
      )
      expect(await getFormData(admin, '/test/parts/1')).toEqual({
        title: 'Epilogue'
      })
    })

    it('opens the forms of items of lists in nested sections', async () => {
      const { admin } = await mountView(
        {
          components: {
            book: {
              type: 'section',
              nested: true,
              components: { chapters: createChaptersSchema() }
            }
          }
        },
        { book: { chapters } }
      )
      expect(await getFormData(admin, '/test/book/chapters/1')).toEqual({
        title: 'Epilogue'
      })
    })

    it('opens the forms of items of lists with normalized paths', async () => {
      const { admin } = await mountView(
        { components: { tableOfURLs: createChaptersSchema() } },
        { tableOfURLs: chapters },
        { api: { normalizePaths: true } }
      )
      expect(await getFormData(admin, '/test/table-of-urls/1')).toEqual({
        title: 'Epilogue'
      })
    })

    it('links the items of lists in sections of single-component views', async () => {
      const { admin, view } = await mountView(
        {
          component: {
            type: 'section',
            components: { chapters: createChaptersSchema() }
          }
        },
        { chapters }
      )
      const list = admin.getComponent(view, 'chapters')
      const path = list.getEditPath(1)
      expect(await getFormData(admin, path)).toEqual({ title: 'Epilogue' })
    })

    it('links the items of lists in inlined objects to their forms', async () => {
      const { admin, view } = await mountView(
        {
          components: {
            book: {
              type: 'object',
              components: { chapters: createChaptersSchema() }
            }
          }
        },
        { book: { chapters } }
      )
      const list = admin.getComponent(view, 'book/chapters')
      const path = list.getEditPath(1)
      expect(await getFormData(admin, path)).toEqual({ title: 'Epilogue' })
    })

    describe('of lists linked to views', () => {
      // Mounts a `books` view with a list that edits the books in its form,
      // and the `test` view with a list linked to the `books` view.
      async function mountLinkedList() {
        const { admin, view } = await mountView(
          {
            components: {
              books: {
                type: 'list',
                view: 'books',
                editable: true,
                creatable: true
              }
            }
          },
          { books: [{ id: 5, title: 'Emma' }] },
          {
            views: {
              books: {
                type: 'view',
                components: {
                  items: {
                    type: 'list',
                    resource: { path: 'books' },
                    form: createChapterForm()
                  }
                }
              }
            },
            request: () => ({ data: [] })
          }
        )
        return admin.getComponent(view, 'books')
      }

      it('link the items to the forms in multi-component views', async () => {
        const list = await mountLinkedList()
        expect(list.getEditPath(0)).toBe('/books/items/5')
      })

      it('create items in the forms of the views', async () => {
        const list = await mountLinkedList()
        expect(list.creatable).toBe(true)
        expect(list.sourceContext.createPath).toBe('/books/items/create')
      })
    })
  })

  describe('setupSchema()', () => {
    const api = { normalizePath: path => path }

    it('refuses resources of inlined lists', async () => {
      const schema = {
        type: 'list',
        inlined: true,
        resource: { path: 'books' },
        form: { type: 'form', components: {} }
      }
      await expect(
        getTypeDescriptor(schema).setupSchema({ schema, api, name: 'books' })
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
        getTypeDescriptor(schema).setupSchema({
          schema,
          api,
          name: 'publisher'
        })
      ).rejects.toThrow('Nested objects cannot load data from their own')
    })

    it('refuses wrapped primitives in mutating routed forms', async () => {
      const schema = {
        type: 'list',
        wrapPrimitives: 'tag',
        mutate: true,
        form: { type: 'form', components: { tag: { type: 'text' } } }
      }
      await expect(
        getTypeDescriptor(schema).setupSchema({ schema, api, name: 'tags' })
      ).rejects.toThrow(
        `Unsupported 'mutate' in lists with 'wrapPrimitives': 'tags'.`
      )
    })
  })
})
