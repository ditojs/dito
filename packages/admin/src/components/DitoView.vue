<template lang="pug">
  // If view is not active, render router-view to nest further route components
  router-view(v-if="!isLastRoute")
  .dito-view.dito-scroll(v-else)
    component.dito-scroll-content(
      :is="getTypeComponent(schema.type)"
      :schema="schema"
      :dataPath="name"
      :data="data"
      :meta="meta"
      :store="getChildStore(name)"
    )
</template>

<style lang="sass">
.dito
  .dito-view
    position: relative
    display: flex
    flex-flow: column
</style>

<script>
import DitoComponent from '@/DitoComponent'
import RouteMixin from '@/mixins/RouteMixin'

export default DitoComponent.component('dito-view', {
  mixins: [RouteMixin],

  data() {
    return {
      isView: true,
      viewData: {}
    }
  },

  computed: {
    schema() {
      return this.meta.schema
    },

    name() {
      return this.schema.name
    },

    data() {
      if (!(this.name in this.viewData)) {
        // Set up viewData so we can pass it on to the nested component which
        // will look up its own data under its name, see this.value
        // NOTE: DitoView isn't doing any actual data loading. Only DitoList
        // and DitoForm use the DataMixin and are capable of requesting and
        // mutating data, but they inherit the data container from DitoView.
        this.viewData = {
          [this.name]: null
        }
      }
      return this.viewData
    }
  }
})
</script>
