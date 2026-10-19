import productPage from './components/product-page.js'

export const dashboard = {
  type: 'view',
  label: 'Dashboard',
  fields: {}
} as const

export const product = {
  type: 'page',
  label: 'Product',
  path: 'products/:id?',
  component: productPage
} as const
