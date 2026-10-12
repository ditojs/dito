import { computed, reactive } from 'vue'

// The store of a component holds the state that outlives it while its route is
// shown, e.g. the query of a list while one of its items is edited. Views and
// forms create the stores, and components pass on the ones of their children.
export function useStore(props: { store: Record<string, any> }) {
  return {
    getChildStore(name: string): Record<string, any> {
      return (props.store[name] ??= reactive({}))
    },

    // A ref to the value at `key` in the store, `getDefault()` while unset:
    getStoreRef<T>(key: string, getDefault: () => T) {
      return computed<T>({
        get: () => props.store[key] ?? getDefault(),
        set(value) {
          props.store[key] = value
        }
      })
    }
  }
}
