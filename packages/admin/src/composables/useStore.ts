import { computed, reactive, toRaw } from 'vue'

// Stores hold the state that outlives components while their route is shown,
// e.g. the query of a list while one of its items is edited:
export function useStore(props: { store: Record<string, any> }) {
  return {
    // Computed values create child stores while they evaluate, which shouldn't
    // invalidate them:
    getChildStore(name: string): Record<string, any> {
      return (toRaw(props.store)[name] ??= reactive({}))
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
