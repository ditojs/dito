import LoadingMixin from './LoadingMixin'
import { isFunction, isPromise } from '@ditojs/utils'

// @vue/component
export default {
  mixins: [LoadingMixin],

  data() {
    return {
      isLoading: false,
      asyncDataEntries: {}
    }
  },

  methods: {
    handleDataOption(value, name = 'data', loadingOptions = {}) {
      // See if there is async data loading already in process.
      const asyncEntry = (
        this.asyncDataEntries[name] ||
        this.$set(this.asyncDataEntries, name, {
          dependencyFunction: null,
          resolvedData: null,
          resolving: false
        })
      )
      // If the data callback provided a dependency function when it was called,
      // cal it in every call of `handleDataOption()` to force Vue to keep track
      // of the async dependencies.
      asyncEntry.dependencyFunction?.(this, this.context)

      const { resolvedData } = asyncEntry
      if (resolvedData) {
        // If the data was resolved already, return it and clear the value right
        // away. This works because Vue caches the result of computed properties
        // and only reevaluates if one of the dependencies changed. This is to
        // ensure that a cached value here doesn't block async reevaluation:
        asyncEntry.resolvedData = null
        return resolvedData
      }
      let data = null
      // Avoid calling the data function twice:
      if (!asyncEntry.resolving) {
        if (isFunction(value)) {
          const result = value.call(this, this.context)
          // If the result of the data function is another function, then the
          // first data function is there to track dependencies and the real
          // data loading happens in the function that it returned. Keep track
          // it in `dependencyFunction` so it can be called on each call of
          // `handleDataOption()` to keep the dependencies intact, and call the
          // function that it returned once to get the actual data:
          if (isFunction(result)) {
            asyncEntry.dependencyFunction = value
            data = result.call(this, this.context)
          } else {
            data = result
          }
        } else {
          data = value
        }
        if (isPromise(data)) {
          // If the data is asynchronous, it can't be returned straight away.
          // But we can cheat using computed properties and `resolvedData`,
          // which is going to receive the loaded data asynchronously,
          // triggering a recompute of the computed property that calls
          // `handleDataOption()`.
          asyncEntry.resolving = true
          this.resolveData(data).then(data => {
            asyncEntry.resolvedData = data
            asyncEntry.resolving = false
          }, loadingOptions)
          // Clear data until promise is resolved and `resolvedData` is set
          data = null
        }
      }
      return data
    },

    async resolveData(load, loadingOptions = {}) {
      this.setLoading(true, loadingOptions)
      let data = null
      try {
        data = await (isFunction(load) ? load() : load)
      } catch (error) {
        this.addError(error.message || error)
      }
      this.setLoading(false, loadingOptions)
      return data
    }
  }
}
