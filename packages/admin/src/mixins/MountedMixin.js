export default {
  data() {
    return {
      isMounted: false
    }
  },

  mounted() {
    this.isMounted = true
  },

  beforeDestroy() {
    this.isMounted = false
  }
}
