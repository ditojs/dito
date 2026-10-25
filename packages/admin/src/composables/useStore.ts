import { computed, reactive, toRaw } from 'vue'

// Stores hold the state that outlives components while their route is shown,
// e.g. the query of a list while one of its items is edited:
export function useStore(props: { store: Record<string, any> }) {
  return {
    getChildStore(name: string): Record<string, any> {
      return getChildStore(props.store, name)
    },

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

// Computed values create child stores while they evaluate, which shouldn't
// invalidate them:
export function getChildStore(
  store: Record<string, any>,
  name: string
): Record<string, any> {
  return (toRaw(store)[name] ??= reactive({}))
}
