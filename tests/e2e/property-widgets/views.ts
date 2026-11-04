import authorPage from './components/author-page.js'
import volumePage from './components/volume-page.js'
import collectionPage from './components/collection-page.js'

export const author = {
  type: 'page',
  label: 'Author',
  path: 'authors/:id?',
  component: authorPage
} as const

export const volume = {
  type: 'page',
  label: 'Volume',
  path: 'volumes/:id?',
  component: volumePage
} as const

export const collection = {
  type: 'page',
  label: 'Collection',
  path: 'collections/:id?',
  component: collectionPage
} as const
