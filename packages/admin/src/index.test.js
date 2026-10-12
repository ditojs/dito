import DefaultExport, * as exports from './index.js'
import DitoAdmin from './DitoAdmin.js'
import { defineType } from './utils/schema/types.ts'

describe('@ditojs/admin exports', () => {
  it('exports `DitoAdmin` as default and named export', () => {
    expect(DefaultExport).toBe(DitoAdmin)
    expect(exports.DitoAdmin).toBe(DitoAdmin)
  })

  it('exports `defineType()` to define custom types', () => {
    expect(exports.defineType).toBe(defineType)
  })
})
