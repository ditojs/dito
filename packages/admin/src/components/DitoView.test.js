import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, mountSchema, mountForm } from '../test/mount.js'

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

  it('redirects to the root when its `if` hides it', async () => {
    const admin = await mountAdmin({
      views: {
        drafts: {
          type: 'view',
          if: ({ user }) => user.username === 'editor',
          components: { title: { type: 'text' } }
        }
      }
    })
    await admin.navigate('/drafts')
    expect(admin.router.currentRoute.value.path).toBe('/')
    expect(admin.wrapper.find('.dito-view').exists()).toBe(false)
  })

  describe('source components', () => {
    it('are the main component of single-component views', async () => {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'books' },
              columns: { title: {} }
            }
          }
        },
        request: () => ({ data: [] })
      })
      await admin.navigate('/books')
      const view = admin.getRouteComponent(it => it.isView)
      expect(view.mainComponent.name).toBe('books')
      // Components of the view outside of the list, e.g. its schema, use the
      // list as their source:
      expect(view.mainSchemaComponent.sourceComponent).toBe(
        view.mainComponent
      )
      expect(view.mainSchemaComponent.resourceComponent).toBe(
        view.mainComponent
      )
      // Lists in single-component views use the view's path for sub-paths:
      expect(view.getChildPath('books')).toBe('/books')
    })

    it('are missing in views with multiple components', async () => {
      const admin = await mountAdmin({
        views: {
          library: {
            type: 'view',
            components: { title: { type: 'text' } }
          }
        }
      })
      await admin.navigate('/library')
      const view = admin.getRouteComponent(it => it.isView)
      expect(view.mainComponent).toBe(null)
      expect(view.mainSchemaComponent.sourceComponent).toBe(null)
      expect(view.getChildPath('books')).toBe('/library/books')
    })
  })

  // The components of views hold their data paths relative to the view's data,
  // which is their root item also when the view has no resource.
  describe('root items of components', () => {
    const components = {
      venue: { type: 'text' },
      headline: {
        type: 'text',
        if: ({ rootItem }) => !!rootItem?.venue
      },
      address: {
        type: 'section',
        nested: true,
        components: { city: { type: 'text' } }
      }
    }
    const data = {
      venue: 'Bakery',
      headline: 'Fresh',
      address: { city: 'Basel' }
    }

    function expectRootItems(view, getComponent) {
      const venue = getComponent('venue')
      expect(venue.rootData).toBe(view.data)
      expect(venue.rootItem).toBe(view.data)
      expect(venue.context.rootItem).toBe(view.data)
      expect(venue.context.item).toBe(view.data)
      // The `if` of components sees the root item before they are rendered:
      expect(getComponent('headline')).not.toBe(null)
      const city = getComponent('address/city')
      expect(city.context.rootItem).toBe(view.data)
      expect(city.context.item).toBe(view.data.address)
      expect(city.context.parentItem).toBe(view.data)
      expect(city.parentData).toBe(view.data)
    }

    it('are the data of multi-component views without resources', async () => {
      const { routeComponent: view, getComponent } = await mountSchema({
        schema: { components },
        data
      })
      expectRootItems(view, getComponent)
    })

    it('are the data of single-component views without resources', async () => {
      const { routeComponent: view, getComponent } = await mountSchema({
        schema: {
          component: { type: 'section', components }
        },
        data
      })
      expectRootItems(view, getComponent)
    })

    it('are the data of views with resources', async () => {
      const { routeComponent: view, getComponent } = await mountSchema({
        schema: {
          components: {
            ...components,
            books: {
              type: 'list',
              resource: { path: 'books' },
              columns: { title: {} }
            }
          }
        },
        data,
        request: () => ({ data: [] })
      })
      expect(view.providesData).toBe(true)
      expectRootItems(view, getComponent)
    })

    it('are the data of forms with resources', async () => {
      const { routeComponent: form, getComponent } = await mountForm({
        schema: { components },
        data
      })
      const venue = getComponent('venue')
      expect(venue.rootItem).toBe(form.data)
      expect(venue.context.rootItem).toBe(form.data)
      expect(getComponent('address/city').context.parentItem).toBe(form.data)
    })
  })
})
