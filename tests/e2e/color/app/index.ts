import DitoAdmin from '@ditojs/admin'
import '@ditojs/admin/style.css'

new DitoAdmin('#dito-admin', {
  dito,
  views: import('./views/index.js')
})
