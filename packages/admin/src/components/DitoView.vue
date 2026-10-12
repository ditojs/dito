<template lang="pug">
template(
  v-if="admin.user && shouldRenderSchema(schema)"
)
  //- Only render DitoView when it is active, otherwise a normal router-view
  //- instead, to nest further route components.
  //- NOTE: This is different from the handling in DitoForm, where `v-show` is
  //- used to always render forms even when other nested forms are present.
  DitoRouterView(
    v-if="!isLastRoute"
    :routeLevel="route.level + 1"
  )
  .dito-view.dito-scroll-parent(
    v-else
    :data-resource="schemaPath"
  )
    DitoSchema(
      :key="name"
      :schema="schema"
      :data="data"
      :store="getChildStore(name)"
      padding="root"
      :disabled="isLoading"
      scrollable
      single
    )
</template>

<script>
import { computed, markRaw } from 'vue'
import DitoComponent from '../DitoComponent.js'
import RouteMixin from '../mixins/RouteMixin.js'
import { isSingleComponentView } from '../utils/schema/structure.js'
import { DataModel } from '../utils/DataModel.ts'
import { LoadingTracker } from '../utils/LoadingTracker.ts'

// @vue/component
export default DitoComponent.component('DitoView', {
  mixins: [RouteMixin],

  provide() {
    return {
      source: computed(() => this.mainSource),
      resource: computed(() => this.mainResource)
    }
  },

  data() {
    return {
      // Tracks the requests of all resource components in the view, which is
      // disabled while any of them is pending, see `isLoading`:
      loadingTracker: markRaw(
        new LoadingTracker(
          this.parentRoute?.loadingTracker ?? this.admin.loadingTracker
        )
      ),
      // NOTE: Each view has its own data, as `DitoRouterView` renders each
      // route record with its own component instance.
      data: {}
    }
  },

  computed: {
    schema() {
      const { component, ...schema } = this.sourceSchema
      // Render single-component views as views with that component:
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

    // @override SchemaParentMixin.sourceSchema()
    // The view's components display the view's data, as if it were an item of
    // a source with the view's schema:
    sourceSchema() {
      return this.route.node.schema
    },

    name() {
      return this.schema.name
    },

    isView() {
      return true
    },

    isLoading() {
      return this.loadingTracker.isLoading
    },

    isSingleComponentView() {
      return isSingleComponentView(this.sourceSchema)
    },

    mainComponent() {
      return this.mainSchemaComponent?.getComponentByDataPath(this.name)
    },

    // The contexts of the main component, which the view provides to its other
    // components, e.g. its panels and buttons:
    mainSource() {
      return this.mainComponent?.ownSource ?? null
    },

    mainResource() {
      return this.mainComponent?.ownResource ?? null
    },

    // The data paths of the view's components start at its data:
    dataPath() {
      return ''
    },

    // @override DitoMixin.rootData()
    // The data paths of the view's components are relative to its data:
    rootData() {
      return this.data
    }
  },

  created() {
    // Writes defaults and computed values into the view's data and resolves
    // options, see `DataModel`:
    const view = this
    this.ownDataModel = markRaw(
      new DataModel({
        schema: () => this.schema,
        data: () => this.data,
        sourceSchema: () => this.sourceSchema,
        services: {
          admin: this.admin,
          container: this.ownContainer,
          route: this.ownRoute,
          get source() {
            return view.mainSource
          },
          get resource() {
            return view.mainResource
          }
        }
      })
    )
  },

  mounted() {
    // Prevent bypassing of if-condition by direct URL access.
    if (!this.shouldRenderSchema(this.schema)) {
      this.$router.replace({ path: '/' })
    }
  },

  beforeUnmount() {
    // Stop the model before the component's own watchers are stopped, as the
    // model's watchers aren't part of the component, see `DataModel`.
    this.ownDataModel.stop()
  },

  methods: {
    setData(data) {
      this.data = data
      return this.data
    }
  }
})
</script>
