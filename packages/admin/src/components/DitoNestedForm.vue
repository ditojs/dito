<style lang="sass">
.dito
  .dito-nested-form
    .dito-scroll
      // No nested scrolling:
      overflow: visible
</style>

<script>
import DitoForm from './DitoForm'

export default DitoForm.extend({
  data() {
    return {
      formClass: 'dito-nested-form'
    }
  },

  watch: {
    $fields: {
      // Whenever a field changes on a direct editing form, loop through all of
      // them and attach / flag the field back up on the parent's validator.
      // Unfortunately we can't just share the $validator with the parent form,
      // since closing the nested form would remove all its fields immediately,
      // and wee need them around to know if a direct editing form changed data.
      handler(fields) {
        const validator = this.rootFormComponent.$validator
        for (const [name, field] of Object.entries(fields)) {
          if (!(name in validator.flags)) {
            validator.attach({ name })
          }
          validator.flag(name, field)
        }
      },
      deep: true
    }
  },

  computed: {
    isNested() {
      return true
    },

    verbs() {
      return {
        ...this.getVerbs(),
        cancel: 'close',
        cancelled: 'closed'
      }
    }
  }
})
</script>
