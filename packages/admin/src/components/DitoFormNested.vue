<style lang="sass">
  .dito-form-nested
    &,
    .dito-scroll
      //- No scrolling inside nested forms, and prevent open .multiselect from
      //- being cropped.
      overflow: visible
</style>

<script>
import DitoComponent from '../DitoComponent.js'
import DitoForm from './DitoForm.vue'

// @vue/component
export default DitoComponent.component('dito-form-nested', {
  extends: DitoForm
})
</script>
