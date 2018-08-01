<template lang="pug">
  // If view is not active, render router-view to nest further route components
  router-view(v-if="!isLastRoute")
  .dito-view.dito-parent(v-else)
    dito-schema.dito-scroll(
      :schema="viewSchema"
      :dataPath="name"
      :data="data"
      :meta="meta"
      :store="getChildStore(name)"
      :disabled="isLoading"
      :generateLabels="false"
      :menuHeader="true"
    )
</template>

<script>
import DitoComponent from '@/DitoComponent'
import RouteMixin from '@/mixins/RouteMixin'

// @vue/component
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

    viewSchema() {
      const { schema } = this
      // If the schema has a type, it is a single-component view. Translate it
      // into a muli-component schema, so it can be handled by DitoSchema also:
      return schema.type
        ? {
          name: schema.name,
          components: {
            [schema.name]: {
              ...schema,
              label: false
            }
          }
        }
        : schema
    },

    isLoading() {
      for (const component of Object.values(this.schema.components || {})) {
        if (component.isLoading) {
          return true
        }
      }
      return false
    }
  }
})
</script>
