<script>
import DitoComponent from '../DitoComponent.js'
import DitoForm from './DitoForm.vue'

// @vue/component
export default DitoComponent.component('DitoFormNested', {
  extends: DitoForm
})
</script>

<style lang="scss">
.dito-form-nested {
  &,
  .dito-scroll {
    // No scrolling inside nested forms, and prevent open .multiselect from
    // being cropped.
    overflow: visible;
  }
}
</style>
