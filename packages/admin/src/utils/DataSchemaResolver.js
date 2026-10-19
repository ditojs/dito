import { computed, shallowRef } from 'vue'
import { isObject, isFunction, isPromise } from '@ditojs/utils'
import { toModelData } from './data.js'

// Resolve data schemas, `{ data, dataPath }`, lazily: nothing loads before
// `value` or `isLoading` is read. `data()` can return a function that loads the
// value, e.g. `({ item: { id } }) => async () => load(id)`, so loads only start
// again when the dependencies of `data()` change. Outdated loads are discarded.
export class DataSchemaResolver {
  currentPromiseOrLoader = null
  // Resolves once the current load finished:
  currentLoadPromise = null
  lastFinishedLoad = shallowRef({
    promiseOrLoader: null,
    value: undefined,
    error: null
  })

  /**
   * @param {any} dataSchema
   * @param {{
   *   createContext: () => object,
   *   onLoadStart?: ((promise: Promise<unknown>) => void) | null
   * }} options
   */
  constructor(dataSchema, { createContext, onLoadStart = null }) {
    this.dataSchema = isObject(dataSchema) ? dataSchema : { data: dataSchema }
    this.createContext = createContext
    this.onLoadStart = onLoadStart
    this.valueOrPromiseOrLoader = computed(() =>
      this.getValueOrPromiseOrLoader()
    )
    // Data that `data()` returns through contexts is editable, see
    // `toModelData()`:
    this.valueOrUndefinedWhileLoading = computed(() =>
      toModelData(this.getValueOrStartLoad())
    )
  }

  get value() {
    return this.valueOrUndefinedWhileLoading.value
  }

  get isLoading() {
    // Read `value` first, so that its loading starts:
    if (this.value !== undefined) {
      return false
    }
    const valueOrPromiseOrLoader = this.valueOrPromiseOrLoader.value
    return (
      isPromiseOrLoader(valueOrPromiseOrLoader) &&
      this.lastFinishedLoad.value.promiseOrLoader !== valueOrPromiseOrLoader
    )
  }

  // Also wait for the loads that replace outdated ones:
  async waitForValue() {
    while (this.isLoading) {
      await this.currentLoadPromise
    }
    return this.value
  }

  // The error of the last load, if it failed and isn't outdated:
  get lastLoadError() {
    const { promiseOrLoader, error } = this.lastFinishedLoad.value
    return promiseOrLoader === this.valueOrPromiseOrLoader.value ? error : null
  }

  getValueOrPromiseOrLoader() {
    const { data, dataPath } = this.dataSchema
    if (data !== undefined) {
      return isFunction(data) ? data(this.createContext()) : data
    } else if (dataPath) {
      return this.createContext().getValueAt(dataPath)
    }
  }

  getValueOrStartLoad() {
    const valueOrPromiseOrLoader = this.valueOrPromiseOrLoader.value
    if (!isPromiseOrLoader(valueOrPromiseOrLoader)) {
      return valueOrPromiseOrLoader
    }
    const { promiseOrLoader, value } = this.lastFinishedLoad.value
    if (promiseOrLoader === valueOrPromiseOrLoader) {
      return value
    }
    if (this.currentPromiseOrLoader !== valueOrPromiseOrLoader) {
      this.startLoad(valueOrPromiseOrLoader)
    }
    return undefined
  }

  startLoad(promiseOrLoader) {
    this.currentPromiseOrLoader = promiseOrLoader
    const context = this.createContext()
    // Keep the result unless the load is outdated:
    const finishLoad = (value, error = null) => {
      if (this.currentPromiseOrLoader === promiseOrLoader) {
        this.lastFinishedLoad.value = { promiseOrLoader, value, error }
      }
    }
    // Call loaders in a microtask, outside of the computed property that
    // started the load, so they don't add to its dependencies:
    const promise = Promise.resolve()
      .then(() =>
        isFunction(promiseOrLoader) ? promiseOrLoader(context) : promiseOrLoader
      )
      .then(value => finishLoad(value))
      .catch(error => {
        console.error(error)
        finishLoad(undefined, error)
      })
    this.currentLoadPromise = promise
    this.onLoadStart?.(promise)
  }
}

function isPromiseOrLoader(valueOrPromiseOrLoader) {
  return isFunction(valueOrPromiseOrLoader) || isPromise(valueOrPromiseOrLoader)
}
