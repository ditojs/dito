import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  stubConfirm
} from '../test/mount.js'

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
  })
})
