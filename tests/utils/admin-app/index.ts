import DitoAdmin from '@ditojs/admin'
import '@ditojs/admin/style.css'

// Shared admin entry for all e2e scenarios. `#views` is aliased to the
// scenario's own views module, see `createTestApp()` in `../app.ts`. Views
// are either named exports, or a default export for generated views. An
// `account` export is the admin's `account` option:
const { default: defaultViews, account, ...views } = await import('#views')
new DitoAdmin('#dito-admin', { dito, views: defaultViews ?? views, account })
