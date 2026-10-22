import designerPage from './components/designer-page.js'
import shopSetPage from './components/shop-set-page.js'
import collectionPage from './components/collection-page.js'

export const designer = {
  type: 'page',
  label: 'Designer',
  path: 'designers/:id?',
  component: designerPage
} as const

export const shopSet = {
  type: 'page',
  label: 'Shop Set',
  path: 'shop-sets/:id?',
  component: shopSetPage
} as const

export const collection = {
  type: 'page',
  label: 'Collection',
  path: 'collections/:id?',
  component: collectionPage
} as const
