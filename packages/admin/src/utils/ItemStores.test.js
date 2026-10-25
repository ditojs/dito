import { isReactive } from 'vue'
import { ItemStores } from './ItemStores.js'
import '../types/index.js'

describe('ItemStores', () => {
  const schema = { type: 'list' }
  const primitivesSchema = { type: 'list', wrapPrimitives: 'value' }

  it('keeps one item stores instance in the store of the source', () => {
    const store = {}
    expect(ItemStores.getFromStore(store)).toBe(ItemStores.getFromStore(store))
  })

  it('creates the reactive store of an item on first access', () => {
    const stores = new ItemStores()
    const item = { title: 'One' }
    const store = stores.getStore(schema, item, 0)
    expect(isReactive(store)).toBe(true)
    expect(stores.getStore(schema, item, 1)).toBe(store)
    expect(stores.getStore(schema, { title: 'Two' }, 0)).not.toBe(store)
  })

  it('keeps the stores of wrapped values by their index', () => {
    const stores = new ItemStores()
    const store = stores.getStore(primitivesSchema, { value: 'a' }, 0)
    expect(stores.getStore(primitivesSchema, { value: 'b' }, 0)).toBe(store)
    expect(stores.getStore(primitivesSchema, { value: 'a' }, 1)).not.toBe(
      store
    )
  })

  it('creates a new store once the item store was removed', () => {
    const stores = new ItemStores()
    const item = { title: 'One' }
    const store = stores.getStore(schema, item, 0)
    store.opened = true
    stores.removeStore(schema, item, 0)
    expect(stores.getStore(schema, item, 0)).toEqual({})
  })
})
