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
      }
    }
  }
}
