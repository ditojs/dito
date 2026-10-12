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
      ref="schema"
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
import {
  computed,
  inject,
  markRaw,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  useTemplateRef
} from 'vue'
import { useRouter } from 'vue-router'
import { useRouteContainer } from '../composables/useRouteContainer.ts'
import {
  useServices,
  useSchemaContext
} from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { useStore } from '../composables/useStore.ts'
import { getVerbs } from '../utils/services.ts'
import { isSingleComponentView } from '../utils/schema/structure.js'
import { DataModel } from '../utils/DataModel.ts'
import { LoadingTracker } from '../utils/LoadingTracker.ts'

export default {
  name: 'DitoView',

  setup() {
    const admin = inject('admin')
    const router = useRouter()
    const parentRoute = inject('route', null)
    // The data paths of the view's components start at its data:
    useComponentPath(() => '')
    // NOTE: Each view has its own data, as `DitoRouterView` renders each
    // route record with its own component instance.
    const data = ref({})
    // The view displays its data as if it were an item of its source:
    const sourceSchema = computed(() => routeContainer.ownRoute.node.schema)
    const schema = computed(() => {
      const { component, ...schema } = sourceSchema.value
      // Render single-component views as views with that component:
      return isSingleComponentView(sourceSchema.value)
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
    })
    const name = computed(() => schema.value.name)
    // The view provides the contexts of its main component to the others:
    const mainSource = computed(() =>
      routeContainer.ownRoute.findSourceByDataPath(name.value)
    )
    const mainResource = computed(() => mainSource.value?.resource ?? null)
    // The view is disabled while the requests of its components are pending:
    const loadingTracker = markRaw(
      new LoadingTracker(parentRoute?.loadingTracker ?? admin.loadingTracker)
    )

    const routeContainer = useRouteContainer(
      reactive({
        schema,
        sourceSchema,
        data,
        dataPath: '',
        rootData: data,
        componentPath: '',
        loadingTracker,
        schemaComponent: useTemplateRef('schema'),
        isDirty: computed(() => routeContainer.ownContainer.isDirty),
        breadcrumb: computed(
          () => schema.value.breadcrumb || getLabel(schema.value)
        ),
        verbs: computed(() => getVerbs(services)),

        get dataModel() {
          return dataModel
        },

        setData(value) {
          data.value = value
          return data.value
        }
      })
    )
    const { ownContainer, ownRoute, store } = routeContainer
    provide('sourceSchema', sourceSchema)
    provide('source', mainSource)
    provide('resource', mainResource)
    const services = useServices({
      container: ownContainer,
      route: ownRoute,

      get source() {
        return mainSource.value
      },

      get resource() {
        return mainResource.value
      }
    })
    const { context } = useSchemaContext(
      reactive({ schema, data, dataPath: '' }),
      { services }
    )
    const { getLabel, shouldRenderSchema } = useSchemaValue(context)

    const dataModel = markRaw(
      new DataModel({
        schema: () => schema.value,
        data: () => data.value,
        sourceSchema: () => sourceSchema.value,
        services
      })
    )
    // The model's watchers aren't the component's, see `DataModel`:
    onBeforeUnmount(() => dataModel.stop())

    onMounted(() => {
      // Prevent bypassing of if-condition by direct URL access.
      if (!shouldRenderSchema(schema.value)) {
        router.replace({ path: '/' })
      }
    })

    return {
      ...routeContainer,
      ...useStore({ store }),
      admin,
      route: ownRoute,
      schema,
      name,
      data,
      dataModel,
      shouldRenderSchema,
      isLoading: computed(() => loadingTracker.isLoading)
    }
  }
}
</script>
