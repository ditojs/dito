import DitoAdmin from '@ditojs/admin'
import '@ditojs/admin/style.css'

// Shared admin entry for all e2e scenarios. `#views` is aliased to the
// scenario's own views module, see `createTestApp()` in `../app.ts`.
new DitoAdmin('#dito-admin', {
  dito,
  views: import('#views')
})
