// @vue/component
export default {
  data() {
    return {
      isLoading: false,
      hasLoaded: false
    }
  },

  methods: {
    setLoading(loading) {
      if (!this.isLoading ^ !loading) { // Boolean xor
        this.isLoading = !!loading
        this.appState.loadingCounter += loading ? 1 : -1
        if (!loading) {
          // Use a separate hasLoaded flag to mark the tick / time-frame right
          // after loading in which watch handlers are called, so they can
          // ignore data changes that occurred because of the loading of data.
          // See: TypeMixin.created()
          this.hasLoaded = true
          this.$nextTick(() => {
            this.hasLoaded = false
          })
        }
      }
    }
  }
}
