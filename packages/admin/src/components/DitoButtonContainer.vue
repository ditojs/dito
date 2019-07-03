<style lang="sass">
  .dito-button-container
    & + .dito-button-container
      margin-left: $button-margin
</style>

<script>
import DitoComponentContainer from './DitoComponentContainer'

// @vue/component
export default DitoComponentContainer.component('dito-button-container', {
  computed: {
    width() {
      // Override DitoComponentContainer's width() to not use a default width:
      return this.schema.width
    },

    containerStyle() {
      // Remove 'flex-grow' from DitoComponentContainer's containerStyle()
      return {
        'flex-basis': this.percentage && `${this.percentage}%`
      }
    }
  }
})
</script>
