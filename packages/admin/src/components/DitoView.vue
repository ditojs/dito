<template lang="pug">
template(
  v-if="user && shouldRenderSchema(viewSchema)"
)
  //- Only render DitoView when it is active, otherwise a normal router-view
  //- instead, to nest further route components.
  //- NOTE: This is different from the handling in DitoForm, where `v-show` is
  //- used to always render forms even when other nested forms are present.
  RouterView(
    v-if="!isLastRoute"
    v-slot="{ Component, route }"
  )
    component(
      v-if="Component"
      :is="Component"
      :key="getRouteComponentKey(route, routeLevel + 1)"
    )
  .dito-view.dito-scroll-parent(
    v-else
    :data-resource="sourceSchema.path"
  )
    DitoSchema(
      :key="name"
      :schema="viewSchema"
      :data="data"
      :meta="meta"
      :store="getChildStore(name)"
      padding="root"
      :disabled="isLoading"
      scrollable
      single
    )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import RouteMixin from '../mixins/RouteMixin.js'
import {
  isSingleComponentView,
  someNestedSchemaComponent
} from '../utils/schema/structure.js'
import { hasResource } from '../utils/resource.js'
import { FormModel } from '../utils/FormModel.js'

// @vue/component
export default DitoComponent.component('DitoView', {
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
      // Updated from LoadingMixin through `setLoading(isLoading)`:
      isLoading: false,
      // NOTE: Data is shared across all views because the router recycles the
      // DitoView component.
      data: {}
    }
  },

  computed: {
    schema() {
      return this.meta.schema ?? {}
    },

    name() {
      return this.schema.name
    },

    isView() {
      return true
    },

    isSingleComponentView() {
      return isSingleComponentView(this.schema)
    },

    mainComponent() {
      return this.mainSchemaComponent?.getComponentByDataPath(this.name)
    },

    viewSchema() {
      const { component, ...schema } = this.schema
      // Translate single-component schemas into multi-component schemas,
      // so they can be rendered directly through DitoSchema also:
      return this.isSingleComponentView
        ? {
            ...schema,
            components: {
              [schema.name]: {
                name: schema.name,
                label: false,
                ...component
              }
            }
          }
        : schema
    },

    providesData() {
      return someNestedSchemaComponent(this.viewSchema, hasResource)
    }
  },

  watch: {
    $route: {
      // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
      flush: 'post',
      handler(to, from) {
        // See if the route changes completely, and clear the data if it does.
        if (this.isFullRouteChange(to, from)) {
          this.isLoading = false
          this.data = {}
        }
      }
    }
  },

  created() {
    // Writes defaults and computed values into the view's data and resolves
    // options, see `FormModel`:
    this.formModel = new FormModel({
      component: this,
      getSchema: () => this.viewSchema,
      getData: () => this.data
    })
  },

  mounted() {
    // Prevent bypassing of if-condition by direct URL access.
    if (!this.shouldRenderSchema(this.viewSchema)) {
      this.$router.replace({ path: '/' })
    }
  },

  beforeUnmount() {
    // Stop the model before the component's own watchers are stopped, as the
    // model's watchers aren't part of the component, see `FormModel`.
    this.formModel.stop()
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
