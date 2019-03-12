<style lang="sass">
.dito
  .dito-form-nested
    .dito-scroll
      // No nested scrolling:
      overflow: visible
</style>

<script>
import DitoForm from './DitoForm'

export default DitoForm.component('dito-form-nested', {
  data() {
    return {
      formTag: 'div', // Use a <div> as we shouldn't nest actual <form> tags.
      formClass: 'dito-form-nested'
    }
  },

  watch: {
    $fields: {
      deep: true,
      // Whenever a field changes on a direct editing form, loop through all of
      // them and attach / flag the field back up on the parent's validator.
      // Unfortunately we can't just share the $validator with the parent form,
      // since closing the nested form would remove all its fields immediately,
      // and wee need them around to know if a direct editing form changed data.
      handler(fields) {
        const validator = this.dataRouteComponent.$validator
        if (validator) {
          for (const [name, field] of Object.entries(fields)) {
            if (!(name in validator.flags)) {
              validator.attach({ name })
            }
            validator.flag(name, field)
          }
        }
      }
    }
  },

  computed: {
    isNested() {
      return true
    }
  }
})
</script>
