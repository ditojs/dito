// @vue/component
export default {
  data() {
    return {
      isLoading: false
    }
  },

  methods: {
    setLoading(isLoading, viewComponent = null) {
      if (!this.isLoading ^ !isLoading) { // Boolean xor
        this.isLoading = !!isLoading
        this.appState.loadingCounter += isLoading ? 1 : -1
        // As SourceMixin handles loading for DitoView, control its `isLoading`
        // property from here:
        if (viewComponent) {
          viewComponent.isLoading = this.isLoading
        }
      }
    }
  }
}
