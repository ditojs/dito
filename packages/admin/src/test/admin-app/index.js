import { name } from './shared.js'

// The admin's login uses the shared module before it loads the views.
globalThis.adminName = name
globalThis.loadViews = () => import('./views/books.js')
