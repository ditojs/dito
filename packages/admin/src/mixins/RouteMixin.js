import DataMixin from '@/mixins/DataMixin'

export default {
  mixins: [DataMixin],
  // Each route-component shall provide a vee-validate $validator object,
  // to be shared along all its children.
  // See: https://github.com/logaretm/vee-validate/issues/468
  $validates: true,

  data() {
    return {
      loading: false, // See DataMixin
      isRoute: true
    }
  },

  computed: {
    routeIndex() {
      return this.$vnode.data.routerViewDepth
    },

    routeRecord() {
      // Retrieve the route-record to which this component was mapped to:
      // https://github.com/vuejs/vue-router/issues/1338#issuecomment-296381459
      return this.$route.matched[this.routeIndex]
    },

    meta() {
      return this.routeRecord.meta
    },

    isLastRoute() {
      // Returns true when this router component is the last one in the route.
      const matched = this.$route.matched
      return this.routeRecord === matched[matched.length - 1]
    },

    isLastDataRoute() {
      // Returns true if this is the last router component that is supposed
      // to load data, meaning any component beyond this one uses embedded data.
      const next = this.$route.matched[this.routeIndex + 1]
      return !this.viewDesc.embedded && (!next || !!next.meta.viewDesc.embedded)
    },

    param() {
      // Workaround for vue-router not being able to map multiple url parameters
      // with the same name to multiple components, see:
      // https://github.com/vuejs/vue-router/issues/1345
      return this.$route.params[this.meta.param]
    }
  }
}
