import SchemaParentMixin from './SchemaParentMixin.js'

describe('SchemaParentMixin', () => {
  const { _registerSchemaComponent } = SchemaParentMixin.methods

  it('registers and unregisters schema components', () => {
    const parent = { schemaComponents: [] }
    const first = { name: 'first' }
    const second = { name: 'second' }
    _registerSchemaComponent.call(parent, first, true)
    _registerSchemaComponent.call(parent, second, true)
    _registerSchemaComponent.call(parent, first, false)
    expect(parent.schemaComponents).toEqual([second])
  })

  it(`ignores unregistering components that aren't registered`, () => {
    const registered = { name: 'registered' }
    const parent = { schemaComponents: [registered] }
    _registerSchemaComponent.call(parent, { name: 'unknown' }, false)
    expect(parent.schemaComponents).toEqual([registered])
  })
})
