import { vi } from 'vitest'
import { computed } from 'vue'
import { flushPromises } from '@vue/test-utils'
import SchemaContext from '../SchemaContext.js'
import { mountAdmin, mountSchema, isView } from '../test/mount.js'

describe('AdminContext', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const views = {
    library: {
      type: 'menu',
      label: 'Library',
      items: {
        books: {
          type: 'view',
          label: 'Books',
          fields: { title: { type: 'text' } }
        }
      }
    }
  }

  // Mounts an admin that logs users in with their username, and logs them in
  // without asking for their credentials.
  async function mountAdminWithLogin() {
    const admin = await mountAdmin({
      views,
      request: ({ method, url, data }) =>
        method === 'post' && url === '/logout'
          ? { data: { success: true } }
          : method === 'post' && url === '/login'
            ? { data: { user: { id: 2, username: data.username } } }
            : null
    })
    admin.context.attachDialogsAndNotifications({
      showDialog: async () => ({ username: 'reader', password: 'x' }),
      notify: vi.fn()
    })
    return admin
  }

  it('is provided once to all components', async () => {
    const { admin, routeComponent, getComponent } = await mountSchema({
      schema: { fields: { title: { type: 'text' } } }
    })
    expect(admin.root.adminContext).toBe(admin.context)
    expect(routeComponent.adminContext).toBe(admin.context)
    expect(getComponent('title').context.api).toBe(admin.context.api)
  })

  it('provides the user reactively', async () => {
    const admin = await mountAdminWithLogin()
    const { context } = admin
    const username = computed(() => context.user?.username ?? null)
    expect(username.value).toBe('tester')
    await context.session.logout()
    expect(username.value).toBe(null)
    await context.session.login()
    expect(username.value).toBe('reader')
    await flushPromises()
    expect(admin.wrapper.find('.dito-account').text()).toBe('reader')
  })

  it('provides the views and their route tree reactively', async () => {
    const admin = await mountAdminWithLogin()
    const { context } = admin
    const viewNames = computed(() => Object.keys(context.views))
    const flattenedViewNames = computed(() =>
      Object.keys(context.flattenedViews)
    )
    const nodeCount = computed(() => context.routeTree?.nodes.length ?? 0)
    expect(viewNames.value).toEqual(['library'])
    expect(flattenedViewNames.value).toEqual(['books'])
    expect(nodeCount.value).toBe(1)
    await context.session.logout()
    expect(viewNames.value).toEqual([])
    expect(flattenedViewNames.value).toEqual([])
    expect(nodeCount.value).toBe(0)
    await context.session.login()
    expect(viewNames.value).toEqual(['library'])
    expect(flattenedViewNames.value).toEqual(['books'])
    expect(nodeCount.value).toBe(1)
  })

  it('shows the loading of the admin in the header', async () => {
    const admin = await mountAdmin({ views: {} })
    const header = admin.wrapper.find('.dito-header')
    const end = admin.context.loadingTracker.begin()
    await flushPromises()
    expect(header.attributes('aria-busy')).toBe('true')
    end()
    await flushPromises()
    expect(header.attributes('aria-busy')).not.toBe('true')
  })

  describe('in contexts', () => {
    it('provides its members to the contexts of components', async () => {
      const { admin, getComponent } = await mountSchema({
        schema: { fields: { title: { type: 'text' } } }
      })
      const { context } = getComponent('title')
      expect(context.user).toBe(admin.context.user)
      expect(context.api).toBe(admin.context.api)
      expect(context.views).toBe(admin.context.views)
      expect(context.flattenedViews).toBe(admin.context.flattenedViews)
    })

    it('navigates through the router of the admin', async () => {
      const admin = await mountAdmin({ views })
      await admin.navigate('/library/books?page=2')
      const view = admin.getRouteComponent(isView)
      const { context } = admin.getSchemaComponent(view)
      expect(context.routeQuery).toEqual({ page: '2' })
      expect(context.getRouteUrl({ path: '/library/books' })).toBe(
        '/library/books'
      )
      await context.navigate('/')
      expect(admin.router.currentRoute.value.path).toBe('/')
    })

    it('notifies and remembers it only in the context', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      const { admin, getComponent } = await mountSchema({
        schema: { fields: { title: { type: 'text' } } }
      })
      const notify = vi.spyOn(admin.context, 'notify')
      const component = getComponent('title')
      const { context } = component
      context.notify({ type: 'info', text: 'Saved' })
      expect(notify).toHaveBeenCalledWith({ type: 'info', text: 'Saved' })
      expect(context.wasNotified).toBe(true)
      expect('wasNotified' in component).toBe(false)
      expect(new SchemaContext(component, {}).wasNotified).toBe(false)
      await flushPromises()
      expect(admin.element.querySelector('.dito-notification')).not.toBe(null)
    })
  })
})
