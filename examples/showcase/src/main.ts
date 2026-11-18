import DitoAdmin from '@ditojs/admin'
import '@ditojs/admin/style.css'
import { request } from './api.js'
import * as views from './views.js'

new DitoAdmin('#dito-admin', {
  dito: { base: '/' },
  api: { url: '/api', request },
  views
})
