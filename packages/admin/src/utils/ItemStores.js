import { markRaw, reactive } from 'vue'

// Key the stores of items by their uids, so that they follow their items, and
// keep them in the store of the source, so that they live as long as it.
export class ItemStores {
  #storesByUid = new Map()

  static getFromStore(store) {
    store.$itemStores ??= markRaw(new ItemStores())
    return store.$itemStores
  }

  // Creating stores while rendering is safe, as the map isn't reactive:
  getStore(uid) {
    let store = this.#storesByUid.get(uid)
    if (!store) {
      store = reactive({})
      this.#storesByUid.set(uid, store)
    }
    return store
  }

  removeStore(uid) {
    this.#storesByUid.delete(uid)
  }
}
