import { shallowRef } from 'vue'

// LoadingTracker counts the pending operations of a scope, e.g. the requests of
// a resource component, of all components in a view, or of the whole admin.
// Each operation is forwarded to the tracker of the enclosing scope, so that a
// scope is loading as long as any operation within it is pending, regardless
// of the order in which they finish. `isLoading` is reactive.

export class LoadingTracker {
  #pendingCount = shallowRef(0)

  constructor(parent = null) {
    this.parent = parent
  }

  get isLoading() {
    return this.#pendingCount.value > 0
  }

  // The tracker of the outermost scope, e.g. to show that something is loading
  // without disabling the scopes in between.
  get root() {
    return this.parent?.root ?? this
  }

  // Begins an operation in this scope and its enclosing ones, and returns the
  // function that ends it. Ending an operation more than once has no effect.
  begin() {
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

  // Tracks the operation that `callback()` performs until its returned promise
  // settles, and returns its result.
  async track(callback) {
    const end = this.begin()
    try {
      return await callback()
    } finally {
      end()
    }
  }
}

// A loading operation that is switched on and off instead of begun and ended,
// for the deprecated `setLoading(isLoading)` methods. Switching it on while it
// is on has no effect, as does switching it off while it is off.
export class LoadingSwitch {
  #tracker
  #endOperation = null

  constructor(tracker) {
    this.#tracker = tracker
  }

  get isOn() {
    return !!this.#endOperation
  }

  set(isOn) {
    if (isOn) {
      this.#endOperation ??= this.#tracker.begin()
    } else {
      this.#endOperation?.()
      this.#endOperation = null
    }
  }
}
