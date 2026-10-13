import { vi } from 'vitest'
import { watch } from 'vue'
import { mountAdmin, isForm } from '../test/mount.js'
import { ViewRegistry } from './ViewRegistry.js'
import DitoView from '../components/DitoView.vue'
import DitoForm from '../components/DitoForm.vue'
import DitoFormEmbedded from '../components/DitoFormEmbedded.vue'

describe('ViewRegistry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Creates a registry for `views` with the router and API of an admin
  // without views of its own:
  async function createViewRegistry(views) {
    const admin = await mountAdmin({ views: {} })
    const { api, router } = admin.context
    const viewRegistry = new ViewRegistry({
      api,
      router,
      unresolvedViews: views,
      routeComponents: {
        view: DitoView,
        form: DitoForm,
        embeddedForm: DitoFormEmbedded
      }
    })
    return { admin, viewRegistry }
  }

  it('provides the views only along with their route tree', async () => {
    const { admin, viewRegistry } = await createViewRegistry({
      catalog: {
        type: 'menu',
        label: 'Catalog',
        items: {
          authors: { type: 'view', label: 'Authors', components: {} }
        }
      }
    })
    // `DitoMenu` links to the paths of the route tree as soon as the views
    // are provided:
    const providedPaths = []
    watch(
      () => viewRegistry.views,
      () =>
        providedPaths.push(
          admin.router.resolve({
            name: viewRegistry.routeTree?.nodes[0].linkRouteName
          }).path
        ),
      { flush: 'sync' }
    )
    expect(await viewRegistry.resolve()).toBe(true)
    expect(providedPaths).toEqual(['/catalog/authors'])
  })

  it('replaces the routes of the previous views', async () => {
    const { admin, viewRegistry } = await createViewRegistry({
      books: { type: 'view', label: 'Books', components: {} }
    })
    expect(await viewRegistry.resolve()).toBe(true)
    expect(await viewRegistry.resolve()).toBe(true)
    const paths = admin.router.getRoutes().map(route => route.path)
    expect(paths.filter(path => path === '/books')).toHaveLength(1)
  })

  it('returns false when the views fail to resolve', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldFail = false
    const { viewRegistry } = await createViewRegistry(async () => {
      if (shouldFail) throw new Error('Forbidden')
      return { books: { type: 'view', label: 'Books', components: {} } }
    })
    expect(await viewRegistry.resolve()).toBe(true)
    shouldFail = true
    expect(await viewRegistry.resolve()).toBe(false)
    expect(error).toHaveBeenCalledWith(new Error('Forbidden'))
    expect(Object.keys(viewRegistry.views)).toEqual(['books'])
  })

  it('clears the views and navigates home', async () => {
    const { admin, viewRegistry } = await createViewRegistry({
      books: { type: 'view', label: 'Books', components: {} }
    })
    await viewRegistry.resolve()
    await admin.navigate('/books')
    await viewRegistry.clear()
    expect(viewRegistry.views).toEqual({})
    expect(viewRegistry.routeTree).toBe(null)
    // The routes stay until the views are resolved again:
    const paths = admin.router.getRoutes().map(route => route.path)
    expect(paths).toContain('/books')
    expect(admin.router.currentRoute.value.path).toBe('/')
  })
})

describe('ViewRegistry across sessions', () => {
  // ditojs/dito#187: The views are set up anew for each login from the same
  // schema objects, and their forms need their routes again.
  it('sets up the routes of forms again after logging in again', async () => {
    const admin = await mountAdmin({
      views: {
        books: {
          type: 'view',
          label: 'Books',
          component: {
            type: 'list',
            resource: { path: 'books' },
            form: { type: 'form', components: { title: { type: 'text' } } }
          }
        }
      },
      request({ method = 'get', url }) {
        if (method === 'post' && url === '/logout') {
          return { data: { success: true } }
        }
        if (method === 'post' && url === '/login') {
          return { data: { user: { id: 1, username: 'tester' } } }
        }
        if (method === 'get' && url === '/books') {
          return { data: [{ id: 1, title: 'Dune' }] }
        }
        if (method === 'get' && url === '/books/1') {
          return { data: { id: 1, title: 'Dune' } }
        }
        throw new Error(`Unexpected request: ${method} ${url}`)
      }
    })
    const { session } = admin.context
    session.attachUserInterface({
      requestLoginData: async () => ({ username: 'tester', password: 'x' }),
      notify: vi.fn()
    })
    await session.logout()
    expect(admin.context.user).toBe(null)
    expect(await session.login()).toEqual({ id: 1, username: 'tester' })
    await admin.navigate('/books/1')
    const form = admin.getRouteComponent(isForm)
    expect(form?.data).toEqual({ id: 1, title: 'Dune' })
  })
})
