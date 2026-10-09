import { vi } from 'vitest'
import { getSchemaAccessor, getStoreAccessor } from './accessor.js'

// Creates an object resembling a component, with the accessor defined as a
// property, and `getSchemaValue()` reading from `schema`.
function createSchemaComponent(name, accessor, schema = {}) {
  const component = {
    schema,
    getSchemaValue: vi.fn(keyOrDataPath =>
      [keyOrDataPath].flat().reduce((value, key) => value?.[key], schema)
    )
  }
  Object.defineProperty(component, name, accessor)
  return component
}

function createStoreComponent(name, accessor, store = {}) {
  const component = {
    store,
    getStore: vi.fn(key => store[key]),
    setStore: vi.fn((key, value) => {
      store[key] = value
    })
  }
  Object.defineProperty(component, name, accessor)
  return component
}

describe('getSchemaAccessor()', () => {
  it('reads the schema value with the type, default and callback', () => {
    const component = createSchemaComponent(
      'pageSize',
      getSchemaAccessor('pageSize', { type: Number, default: 20 }),
      { pageSize: 50 }
    )
    expect(component.pageSize).toBe(50)
    expect(component.getSchemaValue).toHaveBeenCalledWith('pageSize', {
      type: Number,
      default: 20,
      callback: true
    })
  })

  it('passes on `callback: false`', () => {
    const component = createSchemaComponent(
      'render',
      getSchemaAccessor('render', { callback: false })
    )
    void component.render
    expect(component.getSchemaValue).toHaveBeenCalledWith('render', {
      type: undefined,
      default: undefined,
      callback: false
    })
  })

  it('reads nested schema values through dotted keys', () => {
    const component = createSchemaComponent(
      'dateFormat',
      getSchemaAccessor('formats.date'),
      { formats: { date: 'short' } }
    )
    expect(component.dateFormat).toBe('short')
    expect(component.getSchemaValue).toHaveBeenCalledWith(
      ['formats', 'date'],
      expect.anything()
    )
  })

  it('overrides the schema value when set', () => {
    const component = createSchemaComponent(
      'collapsed',
      getSchemaAccessor('collapsed', { type: Boolean }),
      { collapsed: true }
    )
    component.collapsed = false
    expect(component.collapsed).toBe(false)
    expect(component.overrides).toEqual({ collapsed: false })
    // Changes to the schema no longer have an effect:
    component.schema.collapsed = true
    expect(component.collapsed).toBe(false)
  })

  it('also overrides with `undefined`', () => {
    const component = createSchemaComponent(
      'collapsed',
      getSchemaAccessor('collapsed'),
      { collapsed: true }
    )
    component.collapsed = undefined
    expect(component.collapsed).toBe(undefined)
  })

  it('stores overrides of nested values under normalized data paths', () => {
    const component = createSchemaComponent(
      'dateFormat',
      getSchemaAccessor('formats.date'),
      { formats: { date: 'short' } }
    )
    component.dateFormat = 'long'
    expect(component.overrides).toEqual({ 'formats/date': 'long' })
    expect(component.dateFormat).toBe('long')
  })

  it('passes the value or override to getters with a parameter', () => {
    const component = createSchemaComponent(
      'pageSize',
      getSchemaAccessor('pageSize', { get: value => value ?? 10 }),
      {}
    )
    expect(component.pageSize).toBe(10)
    component.pageSize = 25
    expect(component.pageSize).toBe(25)
  })

  it('does not read the schema value for getters without parameters', () => {
    const component = createSchemaComponent(
      'pageSize',
      getSchemaAccessor('pageSize', {
        get() {
          return this.schema.pageSize * 2
        }
      }),
      { pageSize: 10 }
    )
    expect(component.pageSize).toBe(20)
    expect(component.getSchemaValue).not.toHaveBeenCalled()
  })

  it('delegates to custom setters instead of overriding', () => {
    const set = vi.fn()
    const component = createSchemaComponent(
      'pageSize',
      getSchemaAccessor('pageSize', { set }),
      { pageSize: 10 }
    )
    component.pageSize = 25
    expect(set).toHaveBeenCalledWith(25)
    expect(set.mock.contexts[0]).toBe(component)
    expect(component.overrides).toBe(undefined)
    expect(component.pageSize).toBe(10)
  })
})

describe('getStoreAccessor()', () => {
  it('reads and writes the value in the store', () => {
    const component = createStoreComponent('page', getStoreAccessor('page'), {
      page: 2
    })
    expect(component.page).toBe(2)
    component.page = 3
    expect(component.store).toEqual({ page: 3 })
  })

  it('returns the default value for missing values without storing it', () => {
    const component = createStoreComponent(
      'page',
      getStoreAccessor('page', { default: 1 })
    )
    expect(component.page).toBe(1)
    expect(component.setStore).not.toHaveBeenCalled()
    expect(component.store).toEqual({})
    component.page = 2
    expect(component.page).toBe(2)
    expect(component.store).toEqual({ page: 2 })
  })

  it('calls default functions on the component', () => {
    const component = createStoreComponent(
      'expanded',
      getStoreAccessor('expanded', {
        default() {
          return this.store.collapsedByDefault ? [] : ['all']
        }
      }),
      { collapsedByDefault: true }
    )
    expect(component.expanded).toEqual([])
  })

  it('does not apply the default to `null` values', () => {
    const component = createStoreComponent(
      'page',
      getStoreAccessor('page', { default: 1 }),
      { page: null }
    )
    expect(component.page).toBe(null)
    expect(component.setStore).not.toHaveBeenCalled()
  })

  it('passes stored and default values through the getter', () => {
    const component = createStoreComponent(
      'page',
      getStoreAccessor('page', { default: '1', get: value => +value })
    )
    expect(component.page).toBe(1)
    component.page = '2'
    expect(component.page).toBe(2)
    expect(component.store.page).toBe('2')
  })

  it('stores values returned by the setter', () => {
    const component = createStoreComponent(
      'page',
      getStoreAccessor('page', { set: value => Math.max(1, value) })
    )
    component.page = -5
    expect(component.store.page).toBe(1)
  })

  it('does not store when the setter returns `undefined`', () => {
    const set = vi.fn()
    const component = createStoreComponent(
      'page',
      getStoreAccessor('page', { set })
    )
    component.page = 4
    expect(set).toHaveBeenCalledWith(4)
    expect(component.setStore).not.toHaveBeenCalled()
  })
})
