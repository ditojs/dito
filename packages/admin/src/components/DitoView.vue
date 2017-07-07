<template lang="pug">
  .dito-view
    div.dito-scroll(v-if="isLastRoute")
      component.dito-component.dito-content(
        :is="typeToComponent(viewSchema.type)"
        :schema="viewSchema"
        :name="name"
        :data="data"
        :meta="meta"
      )
    router-view(v-else)
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
    name() {
      return this.viewSchema.name
    },

    data() {
      if (!(this.name in this.viewData)) {
        // Set up viewData so we can pass it on to the nested component which
        // will look up its own data under its name, see this.value
        // NOTE: DitoView isn't doing any actual data loading. Only DitoList and
        // DitoForm use the DitoMixin and are capable of requesting and mutating
        // data, but they inherit the data container from DitoView.
        this.viewData = {
          [this.name]: null
        }
      }
      return this.viewData
    }
  }
})
</script>
