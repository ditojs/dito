export default {
  data() {
    return {
      loading: false
    }
  },

  methods: {
    setLoading(loading) {
      if (!this.loading ^ !loading) { // Boolean xor
        this.loading = !!loading
        this.appState.loading += loading ? 1 : -1
      }
    }
  }
}
