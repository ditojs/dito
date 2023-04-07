// @vue/component
export default {
  data() {
    return {
      isLoading: false
    }
  },

  methods: {
    setLoading(isLoading, { updateRoot = false, updateView = false } = {}) {
      if (!this.isLoading ^ !isLoading) {
        // Boolean xor
        this.isLoading = !!isLoading
        if (updateRoot) {
          this.rootComponent.registerLoading(isLoading)
        }
        if (updateView) {
          this.viewComponent.setLoading(this.isLoading)
        }
      }
    }
  }
}
