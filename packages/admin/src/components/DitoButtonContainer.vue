<script>
import DitoComponentContainer from './DitoComponentContainer'

// NOTE: DitoButtonContainer extends DitoComponentContainer and changes the
// behavior of computed properties for use with buttons.
// @vue/component
export default DitoComponentContainer.component('dito-button-container', {
  computed: {
    width() {
      // Override DitoComponentContainer's width() to never use a default width:
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
