import { shallowRef } from 'vue'

// Count the pending operations of a scope, e.g. a resource component, a view
// or the whole admin, and forward them to the enclosing scope.

export class LoadingTracker {
  readonly parent: LoadingTracker | null
  #pendingCount = shallowRef(0)

  constructor(parent: LoadingTracker | null = null) {
    this.parent = parent
  }

  get isLoading(): boolean {
    return this.#pendingCount.value > 0
  }

  // Show that something is loading without disabling the scopes in between:
  get root(): LoadingTracker {
    return this.parent?.root ?? this
  }

  // Ending an operation more than once has no effect:
  begin(): () => void {
    this.#pendingCount.value++
    const endInParent = this.parent?.begin()
    let isEnded = false
    return () => {
      if (!isEnded) {
        isEnded = true
        this.#pendingCount.value--
        endInParent?.()
      }
    }
  }

  async track<T>(callback: () => T | Promise<T>): Promise<T> {
    const end = this.begin()
    try {
      return await callback()
    } finally {
      end()
    }
  }
}
