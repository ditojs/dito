import DitoAdmin from '@ditojs/admin'
import '@ditojs/admin/style.css'
import { request } from './api.js'
import * as views from './views.js'

// Start on the books, as StackBlitz opens the preview at the root:
if (location.pathname === '/') {
  history.replaceState(null, '', '/books')
}

new DitoAdmin('#dito-admin', {
  dito: { base: '/' },
  api: { url: '/api', request },
  views
})
