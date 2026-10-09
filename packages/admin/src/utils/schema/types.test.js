import {
  registerTypeComponent,
  getTypeComponent,
  getTypeOptions,
  getSourceType
} from './types.js'

const shelf = {
  defaultNested: true,
  getSourceType: type => (type === 'shelf' ? 'list' : null)
}
registerTypeComponent('shelf', shelf)
registerTypeComponent('label', { omitSpacing: true })

describe('getTypeComponent()', () => {
  it('returns registered type components', () => {
    expect(getTypeComponent('shelf')).toBe(shelf)
  })

  it('reports unknown types only once', () => {
    expect(() => getTypeComponent('bookcase')).toThrow(
      `Unknown Dito.js component type: 'bookcase'`
    )
    expect(getTypeComponent('bookcase')).toBe(null)
  })

  it('returns `null` for unknown types when allowed', () => {
    expect(getTypeComponent('cupboard', true)).toBe(null)
  })
})

describe('getTypeOptions()', () => {
  it('returns the type component of schemas and types', () => {
    expect(getTypeOptions({ type: 'shelf' })).toBe(shelf)
    expect(getTypeOptions('shelf')).toBe(shelf)
    expect(getTypeOptions({ type: 'drawer' })).toBe(null)
  })
})

describe('getSourceType()', () => {
  it('returns the source type that the type component reports', () => {
    expect(getSourceType({ type: 'shelf' })).toBe('list')
    expect(getSourceType('shelf')).toBe('list')
    expect(getSourceType({ type: 'label' })).toBe(null)
    expect(getSourceType({ type: 'drawer' })).toBe(null)
  })
})
