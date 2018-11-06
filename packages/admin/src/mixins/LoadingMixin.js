// @vue/component
export default {
  data() {
    return {
      isLoading: false
    }
  },

  methods: {
    setLoading(loading) {
      if (!this.isLoading ^ !loading) { // Boolean xor
        this.isLoading = !!loading
        this.appState.loadingCounter += loading ? 1 : -1
        // As SourceMixin handles loading for DitoView, control its `isLoading`
        // property from here:
        if (this.viewComponent) {
          this.viewComponent.isLoading = this.isLoading
        }
      }
    }
  }
}
