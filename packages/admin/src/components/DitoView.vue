<template lang="pug">
template(
  v-if="user && shouldRenderSchema(viewSchema)"
)
  //- Only render DitoView when it is active, otherwise a normal router-view
  //- instead, to nest further route components.
  //- NOTE: This is different from the handling in DitoForm, where `v-show` is
  //- used to always render forms even when other nested forms are present.
  DitoRouterView(
    v-if="!isLastRoute"
    :routeLevel="routeLevel + 1"
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
import { markRaw } from 'vue'
import { deprecate } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import RouteMixin from '../mixins/RouteMixin.js'
import {
  isSingleComponentView,
  someNestedSchemaComponent
} from '../utils/schema/structure.js'
import { hasResource } from '../utils/resource.js'
import { DataModel } from '../utils/DataModel.js'
import { LoadingTracker, LoadingSwitch } from '../utils/LoadingTracker.js'

// @vue/component
export default DitoComponent.component('DitoView', {
  mixins: [RouteMixin],

  provide() {
    return {
      // Redirect $sourceComponent and $resourceComponent to the main component:
      $sourceComponent: () => this.mainComponent?.sourceComponent || null,
      $resourceComponent: () => this.mainComponent?.resourceComponent || null,
      $loadingTracker: () => this.loadingTracker
    }
  },

  data() {
    // Tracks the requests of all resource components in the view, which is
    // disabled while any of them is pending, see `isLoading`:
    const loadingTracker = new LoadingTracker(this.$loadingTracker())
    return {
      loadingTracker: markRaw(loadingTracker),
      // The loading operation of the deprecated `setLoading()`.
      setLoadingSwitch: markRaw(new LoadingSwitch(loadingTracker)),
      // NOTE: Each view has its own data, as `DitoRouterView` renders each
      // route record with its own component instance.
      data: {}
    }
  },

  computed: {
    schema() {
      // The routes of views always have a schema, see `setupView()`:
      return this.meta.schema
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
    },

    // @override DitoMixin.rootData()
    // The data paths of the view's components are relative to its data, also
    // when the view has no resource and thus isn't a data component.
    rootData() {
      return this.data
    }
  },

  created() {
    // Writes defaults and computed values into the view's data and resolves
    // options, see `DataModel`:
    this.ownDataModel = markRaw(
      new DataModel({
        component: this,
        getSchema: () => this.viewSchema,
        getData: () => this.data
      })
    )
  },

  mounted() {
    // Prevent bypassing of if-condition by direct URL access.
    if (!this.shouldRenderSchema(this.viewSchema)) {
      this.$router.replace({ path: '/' })
    }
  },

  beforeUnmount() {
    // Stop the model before the component's own watchers are stopped, as the
    // model's watchers aren't part of the component, see `DataModel`.
    this.ownDataModel.stop()
    // Don't leave the root loading after the view is gone, see the deprecated
    // `setLoading()`.
    this.setLoadingSwitch.set(false)
  },

  methods: {
    /**
     * @deprecated `isLoading` is tracked by `loadingTracker` now. Use
     * `loadingTracker.begin()` and call the function that it returns, or
     * `loadingTracker.track(callback)` instead.
     */
    setLoading(isLoading) {
      deprecate(
        'DitoView.setLoading() is deprecated, use ' +
        '`loadingTracker.begin()` or `loadingTracker.track()` instead.'
      )
      this.setLoadingSwitch.set(isLoading)
    },

    setData(data) {
      this.data = data
      return this.data
    },

    getChildPath(path) {
      // Lists inside single-component views use the view's path for sub-paths:
      return this.isSingleComponentView
        ? this.path
        : `${this.path}/${path}`
    }
  }
})
</script>
