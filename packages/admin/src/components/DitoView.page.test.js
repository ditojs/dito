import { vi } from 'vitest'
import { h } from 'vue'
import { useRoute } from 'vue-router'
import { mountAdmin } from '../test/mount.js'
import { useDitoContext } from '../index.js'

describe('page views', () => {
  // Renders the label of its schema and the route params:
  const ProductPage = {
    setup() {
      const route = useRoute()
      const { schema } = useDitoContext()
      return () =>
        h('p', { class: 'product' }, `${schema.label} ${route.params.id}`)
    }
  }

  const views = {
    books: { type: 'view', label: 'Books', fields: {} },
    cachePurge: {
      type: 'page',
      label: 'Cache Purge',
      path: 'tools/cache-purge',
      // Like `() => import('./CachePurgePage.vue')`:
      component: () =>
        Promise.resolve({
          default: { render: () => h('p', 'Purge') },
          [Symbol.toStringTag]: 'Module'
        })
    },
    product: {
      type: 'page',
      label: 'Product',
      path: 'products/:id',
      component: ProductPage
    }
  }

  const getMenuLabels = admin =>
    admin.wrapper.findAll('.dito-menu__link').map(link => link.text())

  it('renders their component under their path', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/tools/cache-purge')
    expect(admin.wrapper.find('.dito-view p').text()).toBe('Purge')
  })

  it('lead the paths below them back to them', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/tools/cache-purge/unknown')
    expect(admin.router.currentRoute.value.path).toBe('/tools/cache-purge')
    expect(admin.wrapper.find('.dito-view p').text()).toBe('Purge')
    expect(admin.wrapper.find('.dito-view').isVisible()).toBe(true)
  })

  it('pass the route params and their context to their component', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/products/7')
    expect(admin.wrapper.find('.product').text()).toBe('Product 7')
    await admin.navigate('/products/8')
    expect(admin.wrapper.find('.product').text()).toBe('Product 8')
  })

  it('scroll their component without a form', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/products/7')
    const page = admin.wrapper.find('.dito-view__page')
    expect(page.classes()).toEqual(
      expect.arrayContaining(['dito-view__page--content', 'dito-scroll'])
    )
    expect(page.find('.product').exists()).toBe(true)
  })

  it('pass no attributes to their component', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/products/7')
    expect(admin.wrapper.find('.product').attributes()).toEqual({
      class: 'product'
    })
  })

  it('provide the context of the page to their component', async () => {
    let context = null
    const admin = await mountAdmin({
      views: {
        tools: {
          type: 'page',
          component: {
            setup() {
              context = useDitoContext()
              return () => h('p')
            }
          }
        }
      }
    })
    await admin.navigate('/tools')
    expect(context.schema.type).toBe('page')
    expect(context.item).toEqual({})
  })

  it('keep the path of their params while they are left', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/products/7')
    const [route] = admin.context.routes
    const navigation = admin.router.push('/books')
    await vi.waitFor(() => expect(route.isLeaving).toBe(true))
    expect(route.path).toBe('/products/7')
    await navigation
  })

  it('get no menu item with required params', async () => {
    const admin = await mountAdmin({
      views: {
        ...views,
        search: { type: 'page', path: 'search/:term?', component: ProductPage }
      }
    })
    expect(getMenuLabels(admin)).toEqual(['Books', 'Cache Purge', 'Search'])
  })

  it(`leave menus that only hold pages with required params out`, async () => {
    const admin = await mountAdmin({
      views: {
        catalog: {
          type: 'menu',
          label: 'Catalog',
          items: {
            product: views.product,
            books: views.books
          }
        },
        shop: {
          type: 'menu',
          label: 'Shop',
          items: { product: { ...views.product, path: 'items/:id' } }
        }
      }
    })
    expect(getMenuLabels(admin)).toEqual(['Catalog', 'Books'])
    // Menus link to their first item with a menu item:
    const link = admin.wrapper.find('.dito-menu__link')
    expect(link.attributes('href')).toBe('/catalog/books')
    // Menus without one link to their own path in the trail:
    await admin.navigate('/shop/items/7')
    const trailLinks = admin.wrapper.findAll('.dito-trail__link')
    expect(trailLinks.map(link => link.attributes('href'))).toEqual([
      '/shop',
      '/shop/items/7'
    ])
  })
})
