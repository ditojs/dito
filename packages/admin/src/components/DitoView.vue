<template lang="pug">
  // Only render DitoView when it is active, otherwise a normal router-view
  // instead, to nest further route components.
  // NOTE: This is different from the handling in DitoForm, where `v-show` is
  // used to always render forms even when other nested forms are present.
  router-view(
    v-if="!isLastRoute"
  )
  .dito-view.dito-scroll-parent(
    v-else-if="shouldRender(viewSchema)"
  )
    dito-schema.dito-scroll(
      ref="schema"
      :schema="viewSchema"
      :key="name"
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
import { isFullyContained } from '@/utils/string'

// @vue/component
export default DitoComponent.component('dito-view', {
  mixins: [RouteMixin],

  data() {
    return {
      isView: true,
      // This is updated from LoadingMixin:
      isLoading: false,
      // NOTE: Data is shared across all views because the router recycles the
      // DitoView component.
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

    isSingleComponent() {
      // If the schema has a type, it is a single-component view.
      return !!this.schema.type
    },

    viewSchema() {
      const { schema } = this
      // Translate single-component schemas into multi-component schemas,
      // so they can be rendered directly through DitoSchema also:
      return this.isSingleComponent
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
    }
  },

  watch: {
    $route(to, from) {
      // See if the route changes completely, and clear the data if it does.
      if (!isFullyContained(from.path, to.path)) {
        this.data = {}
      }
    }
  }
})
</script>
