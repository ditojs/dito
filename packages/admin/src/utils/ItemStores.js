import { markRaw, reactive } from 'vue'

// The stores of the items of a source, see `DitoMixin.getStore()`, keyed by
// the uids of the items, see `getItemUid()`, so that each item keeps its store
// when items are inserted, moved or removed. They are kept in the store of the
// source, so that they live as long as it.
export class ItemStores {
  #storesByUid = new Map()

  // Returns the item stores kept in `store`, the store of a source.
  static getFromStore(store) {
    store.$itemStores ??= markRaw(new ItemStores())
    return store.$itemStores
  }

  // Returns the store of the item with `uid`, created on first access. This
  // happens while rendering the item, which is safe as the map of the stores
  // isn't reactive, only the stores themselves are.
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
