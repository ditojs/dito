import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin } from '../test/mount.js'

describe('DitoView', () => {
  it('gives each view its own data', async () => {
    const admin = await mountAdmin({
      views: {
        books: { type: 'view', components: { title: { type: 'text' } } },
        authors: { type: 'view', components: { name: { type: 'text' } } }
      }
    })
    await admin.navigate('/books')
    const booksView = admin.getRouteComponent(it => it.isView)
    booksView.setData({ title: 'Emma' })
    await admin.navigate('/authors')
    const authorsView = admin.getRouteComponent(it => it.isView)
    expect(authorsView).not.toBe(booksView)
    expect(authorsView.data.title).toBe(undefined)
    await admin.navigate('/books')
    const view = admin.getRouteComponent(it => it.isView)
    expect(view).not.toBe(booksView)
    // The new view sets up its data with the defaults again:
    expect(view.data.title).toBe(null)
  })

  it('stays disabled until all of its lists are loaded', async () => {
    const pendingResponses = {}
    const admin = await mountAdmin({
      views: {
        library: {
          type: 'view',
          components: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              columns: { title: {} }
            },
            authors: {
              type: 'list',
              resource: { path: 'authors' },
              columns: { name: {} }
            }
          }
        }
      },
      request: ({ url }) =>
        new Promise(resolve => {
          pendingResponses[url] = resolve
        })
    })
    await admin.navigate('/library')
    const view = admin.getRouteComponent(it => it.isView)
    const header = admin.wrapper.find('.dito-header')
    expect(Object.keys(pendingResponses).sort()).toEqual([
      '/authors',
      '/books'
    ])
    expect(view.isLoading).toBe(true)
    pendingResponses['/books']({ data: [] })
    await flushPromises()
    expect(view.isLoading).toBe(true)
    expect(header.attributes('aria-busy')).toBe('true')
    pendingResponses['/authors']({ data: [] })
    await flushPromises()
    expect(view.isLoading).toBe(false)
    expect(header.attributes('aria-busy')).toBe('false')
  })

  describe('setLoading()', () => {
    const views = {
      books: { type: 'view', components: { title: { type: 'text' } } },
      authors: { type: 'view', components: { name: { type: 'text' } } }
    }

    it('switches the loading state of the view and warns once', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const admin = await mountAdmin({ views })
      await admin.navigate('/books')
      const view = admin.getRouteComponent(it => it.isView)
      const { rootComponent } = view
      view.setLoading(true)
      view.setLoading(true)
      expect(view.isLoading).toBe(true)
      expect(rootComponent.isLoading).toBe(true)
      view.setLoading(false)
      expect(view.isLoading).toBe(false)
      expect(rootComponent.isLoading).toBe(false)
      const deprecationWarnings = warn.mock.calls.filter(([message]) =>
        String(message).includes('DitoView.setLoading() is deprecated')
      )
      expect(deprecationWarnings).toHaveLength(1)
    })

    it('stops loading when the view unmounts', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const admin = await mountAdmin({ views })
      await admin.navigate('/books')
      const view = admin.getRouteComponent(it => it.isView)
      const { rootComponent } = view
      view.setLoading(true)
      await admin.navigate('/authors')
      expect(rootComponent.isLoading).toBe(false)
    })
  })
})
