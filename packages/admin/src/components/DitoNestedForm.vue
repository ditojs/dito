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
    listData: 'clearClonedData',
    listIndex: 'clearClonedData'
  },

  computed: {
    isNested() {
      return true
    },

    verbCancel() {
      return 'close'
    },

    verbCanceled() {
      return 'closed'
    }
  },

  methods: {
    clearClonedData() {
      this.clonedData = undefined
    }
  }
})
</script>
