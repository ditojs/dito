import { isReactive } from 'vue'
import { ItemStores } from './ItemStores.js'

describe('ItemStores', () => {
  it('keeps one item stores instance in the store of the source', () => {
    const store = {}
    expect(ItemStores.getFromStore(store)).toBe(ItemStores.getFromStore(store))
  })

  it('creates the reactive store of an item on first access', () => {
    const stores = new ItemStores()
    const store = stores.getStore('uid-1')
    expect(isReactive(store)).toBe(true)
    expect(stores.getStore('uid-1')).toBe(store)
    expect(stores.getStore('uid-2')).not.toBe(store)
  })

  it('creates a new store once the item store was removed', () => {
    const stores = new ItemStores()
    const store = stores.getStore('uid-1')
    store.opened = true
    stores.removeStore('uid-1')
    expect(stores.getStore('uid-1')).toEqual({})
  })
})
