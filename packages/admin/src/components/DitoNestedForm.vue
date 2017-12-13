<style lang="sass">
.dito
  .dito-nested-form
    .dito-scroll
      // No nested scrolling:
      overflow: visible
</style>

<script>
import DitoComponent from '@/DitoComponent'
import DitoForm from './DitoForm'

export default DitoComponent.component('dito-nested-form', {
  extends: DitoForm,
  // Provide a separate validator in nested forms:
  $_veeValidate: {
    validator: 'new'
  },

  props: {
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    prefix: { type: String, required: true },
    disabled: { type: Boolean, required: true },
    listData: { type: Array, required: true },
    listIndex: { type: Number, required: true },
    listSchema: { type: Object, required: true },
    parentComponent: { type: Object, required: true }
  },

  data() {
    return {
      formClass: 'dito-nested-form'
    }
  },

  watch: {
    listData: 'clearData',
    listIndex: 'clearData'
  },

  computed: {
    isActive() {
      return true
    },

    isNested() {
      return true
    },

    itemId() {
      return this.getItemId(this.data, this.listIndex)
    },

    type() {
      // TODO: Support form chooser in nested forms.
      return this.data?.type
    },

    create() {
      // TODO: Support creating new entries in nested forms.
      return false
    },

    verbCancel() {
      return 'close'
    },

    verbCanceled() {
      return 'closed'
    }
  },

  methods: {
    close() {
      this.$validator.reset()
      this.parentComponent.edit(null)
    },

    clearData() {
      this.clonedData = undefined
    }
  }
})
</script>
