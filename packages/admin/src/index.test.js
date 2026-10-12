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

  it('exports `getSchemaValue()` for custom components', () => {
    const context = { item: { title: 'Emma' } }
    const schema = {
      label: 'Rating',
      title: ({ item }) => `Rate ${item.title}`
    }
    expect(exports.getSchemaValue(schema, 'label', context)).toBe('Rating')
    expect(exports.getSchemaValue(schema, 'title', context)).toBe('Rate Emma')
    expect(exports.getSchemaValue(schema, 'max', context)).toBe(undefined)
  })
})
