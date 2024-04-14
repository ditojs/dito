<script>
import DitoComponent from '../DitoComponent.js'
import DitoForm from './DitoForm.vue'

// @vue/component
export default DitoComponent.component('DitoFormInlined', {
  extends: DitoForm
})
</script>

<style lang="scss">
.dito-form-inlined {
  // No scrolling in inlined forms, and prevent open .multiselect from
  // being cropped.
  overflow: visible;
}
</style>
