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
    schema: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    prefix: { type: String, required: true },
    listData: { type: Array, required: true },
    listIndex: { type: Number, required: true },
    disabled: { type: Boolean, required: true },
    listComponent: { type: Object, required: true }
  },

  watch: {
    $route() {
      this.clonedData = undefined
    }
  },

  computed: {
    isVisible() {
      return true
    },

    isNested() {
      return true
    },

    itemId() {
      return this.getItemId(this.data, this.listIndex)
    },

    type() {
      // TODO:
      return null
    },

    create() {
      // TODO:
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
      this.listComponent.edit(null)
    }
  }
})
</script>
