import designerPage from './components/designer-page.js'
import shopSetPage from './components/shop-set-page.js'

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
