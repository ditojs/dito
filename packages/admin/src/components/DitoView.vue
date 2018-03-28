<template lang="pug">
  // If view is not active, render router-view to nest further route components
  router-view(v-if="!isLastRoute")
  .dito-view(v-else-if="isMulti")
    // A multi-component view
    dito-schema(
      :schema="schema"
      :dataPath="name"
      :data="data"
      :meta="meta"
      :store="getChildStore(name)"
      :disabled="loading"
      :generateLabels="false"
    )
  .dito-view.dito-scroll(v-else)
    // A single-component view
    component.dito-scroll-content(
      :is="getTypeComponent(type)"
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
      data: {}
    }
  },

  computed: {
    schema() {
      return this.meta.schema
    },

    name() {
      return this.schema.name
    },

    type() {
      return this.schema.type
    },

    isMulti() {
      return this.type === undefined
    },

    loading() {
      for (const component of Object.values(this.schema.components || {})) {
        if (component.loading) {
          return true
        }
      }
      return false
    }
  }
})
</script>
