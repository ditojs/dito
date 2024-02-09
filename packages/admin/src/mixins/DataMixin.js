import {
  isObject,
  isFunction,
  isPromise,
  normalizeDataPath,
  getValueAtDataPath
} from '@ditojs/utils'
import { markRaw, ref } from 'vue'
import LoadingMixin from './LoadingMixin.js'

// @vue/component
export default {
  mixins: [LoadingMixin],

  data() {
    return {
      isLoading: false,
      asyncDataEntries: markRaw({})
    }
  },

  methods: {
    handleDataSchema(schema, name, loadingOptions) {
      if (!isObject(schema)) {
        schema = { data: schema }
      }
      let { data = undefined, dataPath = null } = schema
      // Create a reactive entry for the async data, if it doesn't exist yet.
      // NOTE: `markRaw()` is used to avoid reactivity on `asyncDataEntries`
      // itself, as reactivity is only desired on `reactiveVersion`, which is
      // used to trigger controlled reevaluation of the computed getter.
      const asyncEntry = (this.asyncDataEntries[name] ??= {
        reactiveVersion: ref(1),
        dependencyFunction: null,
        resolvedData: undefined,
        resolving: false,
        resolved: false
      })
      // If the data callback provided a dependency function when it was called,
      // cal it in every call of `handleDataSchema()` to force Vue to keep track
      // of the async dependencies. Also access `reactiveVersion.value` right
      // away, to ensure that the reactive property is tracked as a dependency:
      asyncEntry.reactiveVersion.value &&
      asyncEntry.dependencyFunction?.(this.context)

      if (asyncEntry.resolved) {
        // If the data was resolved already, return it and clear the resolved
        // value. This works because Vue caches the result of computed getters
        // and only reevaluates if one of the dependencies changed. This is to
        // ensure that a cached value here doesn't block / override
        // reevaluation when a dependency changes:
        const { resolvedData } = asyncEntry
        asyncEntry.resolvedData = undefined
        asyncEntry.resolved = false
        return resolvedData
      }
      // Avoid calling the data function twice:
      if (asyncEntry.resolving) {
        data = null
      } else if (data) {
        if (isFunction(data)) {
          const result = data(this.context)
          // If the result of the data function is another function, then the
          // first data function is there to track dependencies and the real
          // data loading happens in the function that it returned. Keep track
          // it in `dependencyFunction` so it can be called on each call of
          // `handleDataSchema()` to keep the dependencies intact, and call
          // the function that it returned once to get the actual data:
          if (isFunction(result)) {
            asyncEntry.dependencyFunction = data
            data = result(this.context)
          } else {
            data = result
          }
        }
        // NOTE: If the data is not a promise, it is resolved already.
        if (isPromise(data)) {
          // If the data is asynchronous, it can't be returned straight away.
          // But we can cheat using computed properties and `resolvedData`,
          // which is going to receive the loaded data asynchronously,
          // triggering a recompute of the computed property that calls
          // `handleDataSchema()`.
          asyncEntry.resolving = true
          this.resolveData(data, loadingOptions)
            .then(data => {
              asyncEntry.resolvedData = data
              asyncEntry.resolving = false
              asyncEntry.resolved = true
              // Trigger reevaluation of the computed getter by increasing the
              // `reactiveVersion` value.
              asyncEntry.reactiveVersion.value++
            })
            .catch(error => {
              console.error(error)
              asyncEntry.resolving = false
            })
          // Clear data until promise is resolved and `resolvedData` is set
          data = null
        }
      } else if (dataPath) {
        data = getValueAtDataPath(
          this.rootData,
          normalizeDataPath(`${this.dataPath}/${dataPath}`)
        )
      }
      return data
    },

    async resolveData(load, loadingOptions = {}) {
      // Use a timeout to allow already resolved promises to return data without
      // showing a loading indicator.
      const timer = setTimeout(() => this.setLoading(true, loadingOptions), 0)
      let data = null
      try {
        data = await (isFunction(load) ? load() : load)
      } catch (error) {
        this.addError(error.message || error)
      }
      clearTimeout(timer)
      this.setLoading(false, loadingOptions)
      return data
    }
  }
}
