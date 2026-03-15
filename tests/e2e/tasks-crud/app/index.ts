// tests/e2e/tasks-crud/app/index.ts
import DitoAdmin from '@ditojs/admin'
import '@ditojs/admin/style.css'

new DitoAdmin('#dito-admin', {
  dito,
  views: import('./views/index.ts')
})
