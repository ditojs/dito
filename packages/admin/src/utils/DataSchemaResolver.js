import { computed, shallowRef } from 'vue'
import {
  isObject,
  isFunction,
  isPromise,
  normalizeDataPath,
  getValueAtDataPath
} from '@ditojs/utils'

// DataSchemaResolver resolves a data schema, `{ data, dataPath }` as used by
// `schema.options` and by the `computed` types, to its value, lazily: Nothing
// is evaluated or loaded before `value` or `isLoading` is read.
//
// - `data` is the value itself, or a function that returns the value, a
//   promise of it, or a function that loads it. In the last case, `data()`
//   only tracks the dependencies and the returned function loads the value,
//   e.g. `data: ({ item: { id } }) => async () => load(id)`, so that loading
//   only starts again when these dependencies change.
// - `dataPath` is resolved relative to the data path of the context, in its
//   root data, e.g. `'../fontFamily/fontShopSets'`.
// - Data schemas that aren't objects are values, e.g. `options: ['A', 'B']`.
//
// While a value is loading, `value` is `undefined` and `isLoading` is `true`.
// If loading fails, the error is logged and kept in `lastLoadError`. Results
// of outdated loads are discarded. Resolved values are returned as they are, so
// that their object identity is kept.
//
// `createContext()` returns the `DitoContext` that `data()` and the loading
// functions are called with. `onLoadStart(promise)` is called with the promise
// of each load, which resolves once the load finished, see `finishLoad()`.

export class DataSchemaResolver {
  // The promise or loading function of the current load, see `startLoad()`:
  currentPromiseOrLoader = null
  // The promise or loading function of the last finished load, with its value
  // or error, see `finishLoad()`:
  lastFinishedLoad = shallowRef({
    promiseOrLoader: null,
    value: undefined,
    error: null
  })

  constructor(dataSchema, { createContext, onLoadStart = null }) {
    this.dataSchema = isObject(dataSchema) ? dataSchema : { data: dataSchema }
    this.createContext = createContext
    this.onLoadStart = onLoadStart
    this.valueOrPromiseOrLoader = computed(() =>
      this.getValueOrPromiseOrLoader()
    )
    this.valueOrUndefinedWhileLoading = computed(() =>
      this.getValueOrStartLoad()
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

  // The error of the last load, if it failed and isn't outdated:
  get lastLoadError() {
    const { promiseOrLoader, error } = this.lastFinishedLoad.value
    return promiseOrLoader === this.valueOrPromiseOrLoader.value ? error : null
  }

  // Returns the value of the data schema, a promise of it, or a function that
  // loads it. Called by a computed property, so that it only runs again when
  // its dependencies change.
  getValueOrPromiseOrLoader() {
    const { data, dataPath } = this.dataSchema
    if (data !== undefined) {
      return isFunction(data) ? data(this.createContext()) : data
    } else if (dataPath) {
      const context = this.createContext()
      // Data that isn't there, e.g. after it was reset by code, has no value,
      // the same as a missing value at an existing data path.
      return getValueAtDataPath(
        context.rootItem,
        normalizeDataPath(`${context.dataPath}/${dataPath}`),
        () => undefined
      )
    }
  }

  // Returns the value of the data schema, or its loaded value once the load
  // of its promise or loading function finished. Until then, it starts the
  // load if it isn't started yet, and returns `undefined`. Called by a
  // computed property, see `value`.
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
    // Keeps the result in `lastFinishedLoad`, unless the load is outdated:
    const finishLoad = (value, error = null) => {
      if (this.currentPromiseOrLoader === promiseOrLoader) {
        this.lastFinishedLoad.value = { promiseOrLoader, value, error }
      }
    }
    // Call loading functions in a microtask, outside of the computed property
    // that started the load, so that they don't add to its dependencies.
    const promise = Promise.resolve()
      .then(() =>
        isFunction(promiseOrLoader) ? promiseOrLoader(context) : promiseOrLoader
      )
      .then(value => finishLoad(value))
      .catch(error => {
        console.error(error)
        finishLoad(undefined, error)
      })
    this.onLoadStart?.(promise)
  }
}

function isPromiseOrLoader(valueOrPromiseOrLoader) {
  return isFunction(valueOrPromiseOrLoader) || isPromise(valueOrPromiseOrLoader)
}
