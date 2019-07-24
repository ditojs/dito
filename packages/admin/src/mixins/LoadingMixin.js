// @vue/component
export default {
  data() {
    return {
      isLoading: false
    }
  },

  methods: {
    setLoading(isLoading, { showSpinner = true, updateView = false } = {}) {
      if (!this.isLoading ^ !isLoading) { // Boolean xor
        this.isLoading = !!isLoading
        if (showSpinner) {
          this.appState.loadingCounter += isLoading ? 1 : -1
        }
        // As SourceMixin handles loading for DitoView, control its `isLoading`
        // property from here:
        if (updateView) {
          this.viewComponent.isLoading = this.isLoading
        }
      }
    }
  }
}
