import {
  defineType,
  getTypeDescriptor,
  getTypeComponent,
  getSourceType,
  getChildSourceSchemas,
  getItemAdapter
} from './types.ts'

const shelfComponent = { name: 'Shelf' }
const shelf = defineType({
  type: ['shelf', 'bookshelf'],
  component: shelfComponent,
  sourceType: 'list',
  defaultNested: false,
  getChildSourceSchemas: schema => [schema.boxes],
  getItemAdapter: () => ({
    name: 'title',
    wrap: title => ({ title }),
    unwrap: ({ title }) => title
  })
})
const plank = defineType({ type: 'plank', component: { name: 'Plank' } })

describe('defineType()', () => {
  it('registers the descriptor under its type', () => {
    expect(getTypeDescriptor('plank')).toBe(plank)
  })

  it('registers the descriptor under all its types', () => {
    expect(getTypeDescriptor('shelf')).toBe(shelf)
    expect(getTypeDescriptor('bookshelf')).toBe(shelf)
  })

  it('applies the defaults of the descriptor', () => {
    expect(shelf).toMatchObject({
      defaultValue: null,
      defaultNested: false,
      defaultVisible: true,
      generatesLabel: true
    })
  })
})

describe('getTypeDescriptor()', () => {
  it('returns the descriptors of schemas and types', () => {
    expect(getTypeDescriptor({ type: 'shelf' })).toBe(shelf)
    expect(getTypeDescriptor({ type: 'drawer' })).toBe(null)
    expect(getTypeDescriptor(null)).toBe(null)
  })
})

describe('getTypeComponent()', () => {
  it('returns the components of types', () => {
    expect(getTypeComponent('shelf')).toBe(shelfComponent)
  })

  it('reports unknown types only once', () => {
    expect(() => getTypeComponent('bookcase')).toThrow(
      `Unknown Dito.js component type: 'bookcase'`
    )
    expect(getTypeComponent('bookcase')).toBe(null)
  })
})

describe('getSourceType()', () => {
  it('returns the source type of the descriptor', () => {
    expect(getSourceType({ type: 'shelf' })).toBe('list')
    expect(getSourceType('shelf')).toBe('list')
    expect(getSourceType({ type: 'plank' })).toBe(null)
    expect(getSourceType({ type: 'drawer' })).toBe(null)
  })
})

describe('getChildSourceSchemas()', () => {
  it('returns the child sources of the descriptor, or none', () => {
    const boxes = { type: 'shelf', name: 'boxes' }
    expect(getChildSourceSchemas({ type: 'shelf', boxes })).toEqual([boxes])
    expect(getChildSourceSchemas({ type: 'plank' })).toEqual([])
  })
})

describe('getItemAdapter()', () => {
  it('returns the item adapter of the descriptor, or none', () => {
    const adapter = getItemAdapter({ type: 'shelf' })
    expect(adapter?.wrap('Dune')).toEqual({ title: 'Dune' })
    expect(adapter?.unwrap({ title: 'Dune' })).toBe('Dune')
    expect(getItemAdapter({ type: 'plank' })).toBe(null)
    expect(getItemAdapter(null)).toBe(null)
  })
})
