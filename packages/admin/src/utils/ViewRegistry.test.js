import { vi } from 'vitest'
import { watch } from 'vue'
import { mountAdmin } from '../test/mount.js'

describe('ViewRegistry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('provides the views only once their routes are set up', async () => {
    const admin = await mountAdmin({
      views: {
        catalog: {
          type: 'menu',
          label: 'Catalog',
          items: {
            authors: { type: 'view', label: 'Authors', components: {} }
          }
        }
      }
    })
    const { viewRegistry } = admin.root
    // `DitoMenu` links to the paths of the views as soon as it receives
    // them. Menus are resolved into new objects without paths each time.
    const providedPaths = []
    watch(
      () => viewRegistry.views,
      views => providedPaths.push(views.catalog?.fullPath),
      { flush: 'sync' }
    )
    expect(await viewRegistry.resolve()).toBe(true)
    expect(providedPaths).toEqual(['/catalog'])
  })

  it('replaces the routes of the previous views', async () => {
    const admin = await mountAdmin({
      views: { books: { type: 'view', label: 'Books', components: {} } }
    })
    const { viewRegistry } = admin.root
    expect(await viewRegistry.resolve()).toBe(true)
    const paths = admin.router.getRoutes().map(route => route.path)
    expect(paths.filter(path => path === '/books')).toHaveLength(1)
  })

  it('returns false when the views fail to resolve', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldFail = false
    const admin = await mountAdmin({
      views: async () => {
        if (shouldFail) throw new Error('Forbidden')
        return { books: { type: 'view', label: 'Books', components: {} } }
      }
    })
    const { viewRegistry } = admin.root
    shouldFail = true
    expect(await viewRegistry.resolve()).toBe(false)
    expect(error).toHaveBeenCalledWith(new Error('Forbidden'))
    expect(Object.keys(viewRegistry.views)).toEqual(['books'])
  })

  it('clears the views and navigates home', async () => {
    const admin = await mountAdmin({
      views: { books: { type: 'view', label: 'Books', components: {} } }
    })
    await admin.navigate('/books')
    const { viewRegistry } = admin.root
    await viewRegistry.clear()
    expect(viewRegistry.views).toEqual({})
    expect(viewRegistry.hasRoutes).toBe(true)
    expect(admin.router.currentRoute.value.path).toBe('/')
  })
})
