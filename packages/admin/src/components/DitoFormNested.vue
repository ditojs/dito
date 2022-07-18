<style lang="sass">
  .dito-form-nested
    &,
    .dito-scroll
      // No scrolling inside nested forms, and prevent open .multiselect from
      // being cropped.
      overflow: visible
</style>

<script>
import DitoForm from './DitoForm.vue'

export default DitoForm.component('dito-form-nested', {})
</script>
