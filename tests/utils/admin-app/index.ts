import DitoAdmin from '@ditojs/admin'
import '@ditojs/admin/style.css'

// Shared admin entry for all e2e scenarios. `#views` is aliased to the
// scenario's own views module, see `createTestApp()` in `../app.ts`. Views
// are either named exports, or a default export for generated views. The
// `account` and `login` exports are the admin's options of the same name:
const {
  default: defaultViews,
  account,
  login,
  ...views
} = await import('#views')
new DitoAdmin('#dito-admin', {
  dito,
  views: defaultViews ?? views,
  account,
  login
})
