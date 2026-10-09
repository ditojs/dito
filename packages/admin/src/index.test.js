import DefaultExport, * as exports from './index.js'
import DitoAdmin from './DitoAdmin.js'

describe('@ditojs/admin exports', () => {
  it('exports `DitoAdmin` as default and named export', () => {
    expect(DefaultExport).toBe(DitoAdmin)
    expect(exports.DitoAdmin).toBe(DitoAdmin)
  })
})
