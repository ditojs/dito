import { markRaw, reactive } from 'vue'
import { getItemUid } from './schema/data.js'
import { getItemAdapter } from './schema/types.ts'

// Key the stores of items by their uids, so that they follow their items, and
// keep them in the store of the source, so that they live as long as it.
// Wrapped values have no identity, so their items keep the stores of their
// index, for the sources and the component tree alike.
export class ItemStores {
  #storesByKey = new Map()

  static getFromStore(store) {
    store.$itemStores ??= markRaw(new ItemStores())
    return store.$itemStores
  }

  // Creating stores while rendering is safe, as the map isn't reactive. `item`
  // and `index` are the ones in the source `schema`:
  getStore(schema, item, index) {
    const key = getKey(schema, item, index)
    let store = this.#storesByKey.get(key)
    if (!store) {
      store = reactive({})
      this.#storesByKey.set(key, store)
    }
    return store
  }

  removeStore(schema, item, index) {
    this.#storesByKey.delete(getKey(schema, item, index))
  }
}

function getKey(schema, item, index) {
  return getItemAdapter(schema) ? index : getItemUid(schema, item)
}
