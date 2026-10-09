import Registry from './Registry.js'

describe('Registry', () => {
  it('registers single handlers by name', () => {
    const registry = new Registry()
    const handler = () => {}
    registry.register('search', handler)
    expect(registry.get('search')).toBe(handler)
    expect(registry.has('search')).toBe(true)
  })

  it('registers all handlers of an object', () => {
    const registry = new Registry()
    const search = () => {}
    const sort = () => {}
    registry.register({ search, sort })
    expect(registry.get('search')).toBe(search)
    expect(registry.get('sort')).toBe(sort)
    expect(registry.getAllowed()).toEqual({ search: true, sort: true })
  })

  it('reports unregistered names as missing', () => {
    const registry = new Registry()
    expect(registry.has('search')).toBe(false)
    expect(registry.get('search')).toBeUndefined()
  })

  it('does not treat inherited object properties as registered', () => {
    const registry = new Registry()
    expect(registry.has('toString')).toBe(false)
    expect(registry.get('constructor')).toBeUndefined()
  })
})
