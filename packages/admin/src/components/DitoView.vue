<template lang="pug">
  // Only render DitoView when it is active, otherwise a normal router-view
  // instead, to nest further route components.
  // NOTE: This is different from the handling in DitoForm, where `v-show` is
  // used to always render forms even when other nested forms are present.
  router-view(
    v-if="!isLastRoute"
    :key="name"
  )
  .dito-view.dito-scroll-parent(
    v-else-if="shouldRender(viewSchema)"
  )
    dito-schema.dito-scroll(
      :schema="viewSchema"
      :data="data"
      :meta="meta"
      :store="getChildStore(name)"
      :disabled="isLoading"
      :generateLabels="false"
      :menuHeader="true"
    )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import RouteMixin from '../mixins/RouteMixin.js'
import { someSchemaComponent, isSingleComponentView } from '../utils/schema.js'
import { hasResource } from '../utils/resource.js'

// @vue/component
export default DitoComponent.component('dito-view', {
  mixins: [RouteMixin],

  provide() {
    // Redirect $sourceComponent and $resourceComponent to the main component:
    return {
      $sourceComponent: () => this.mainComponent?.sourceComponent || null,
      $resourceComponent: () => this.mainComponent?.resourceComponent || null
    }
  },

  data() {
    return {
      isView: true,
      // Updated from LoadingMixin through `setLoading(isLoading)`:
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

    isSingleComponentView() {
      return isSingleComponentView(this.schema)
    },

    mainComponent() {
      return this.mainSchemaComponent.getComponentByDataPath(this.name)
    },

    viewSchema() {
      const { schema } = this
      // Translate single-component schemas into multi-component schemas,
      // so they can be rendered directly through DitoSchema also:
      return this.isSingleComponentView
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

    providesData() {
      return someSchemaComponent(
        this.viewSchema,
        component => hasResource(component)
      )
    }
  },

  watch: {
    $route(to, from) {
      // See if the route changes completely, and clear the data if it does.
      if (this.isFullRouteChange(to, from)) {
        this.isLoading = false
        this.data = {}
      }
    }
  },

  methods: {
    setData(data) {
      this.data = data
    },

    getChildPath(path) {
      // Lists inside single-component views use the view's path for sub-paths:
      return this.isSingleComponentView
        ? this.path
        : `${this.path}/${path}`
    },

    setLoading(isLoading) {
      this.isLoading = !!isLoading
    }
  }
})
</script>
