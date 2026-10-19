import { assertType, describe, it } from 'vitest'
import { defineComponent, h } from 'vue'
import type { MenuSchema, PageSchema, View } from '@ditojs/admin'

describe('PageSchema', () => {
  const ProductPage = defineComponent({ setup: () => () => h('p') })

  it('accepts pages with a component and a path with params', () => {
    assertType<PageSchema>({
      type: 'page',
      label: 'Product',
      path: 'products/:id',
      component: ProductPage,
      if: ({ user }) => !!user
    })
  })

  it('accepts lazy components', () => {
    assertType<PageSchema>({
      type: 'page',
      component: () => Promise.resolve({ default: ProductPage })
    })
  })

  it('joins the views and the items of menus', () => {
    const page: PageSchema = { type: 'page', component: ProductPage }
    assertType<View>(page)
    assertType<MenuSchema>({ type: 'menu', items: { page } })
  })

  it('requires a component', () => {
    // @ts-expect-error: Pages need a component.
    assertType<PageSchema>({ type: 'page' })
  })

  it('rejects the components of views', () => {
    assertType<PageSchema>({
      type: 'page',
      component: ProductPage,
      // @ts-expect-error: Pages hold no schema components.
      fields: {}
    })
  })
})
