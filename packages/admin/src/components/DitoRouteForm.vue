<script>
import DitoComponent from '@/DitoComponent'
import DitoForm from './DitoForm'
import RouteMixin from '@/mixins/RouteMixin'

export default DitoComponent.component('dito-route-form', {
  extends: DitoForm,
  mixins: [RouteMixin],

  data() {
    return {
      // DitoRouteForm never has prefixes, only DitoNestedForm does.
      prefix: ''
    }
  },

  computed: {
    isVisible() {
      return this.isLastRoute
    },

    schema() {
      // Determine the current form schema through the listSchema, with multi
      // form schema support.
      let form = this.getFormSchema(this.data)
      if (!form) {
        // If the right form couldn't be determined from the data, see if
        // there's a query parameter defining it (see `this.type`).
        const { type } = this
        form = type && this.getFormSchema({ type })
      }
      return form
    },

    type() {
      return this.$route.query.type
    },

    create() {
      // this.param is inherited from RouteMixin
      return this.param === 'create'
    },

    itemId() {
      return this.create ? null : this.param
    },

    listData() {
      // Possible parents are DitoRouteForm for forms, or DitoRouteView for root
      // lists. Both have a data property which abstracts away loading and
      // inheriting of data.
      return this.parentRouteComponent.data?.[this.listSchema.name]
    },

    listIndex() {
      // See if we can find item by id in the parent list.
      return this.listData?.findIndex(
        (item, index) => this.getItemId(item, index) === this.itemId
      )
    }
  },

  methods: {
    close(reload) {
      this.$router.push({ path: '..', append: true })
      // Tell the parent to reload its data if this was a submit()
      // See DataMixin.shouldReload:
      const parent = this.parentRouteComponent
      if (reload && !parent.isTransient) {
        parent.reload = true
      }
    }
  }
})
</script>
