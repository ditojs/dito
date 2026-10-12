<template lang="pug">
template(
  v-if="adminContext.user && shouldRenderSchema(schema)"
)
  //- NOTE: Unlike forms, views don't render while their nested routes show.
  DitoRouterView(
    v-if="!isLastRoute"
    :routeLevel="routeContext.level + 1"
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
import {
  computed,
  inject,
  markRaw,
  onMounted,
  provide,
  reactive,
  ref
} from 'vue'
import { useRouter } from 'vue-router'
import { useRouteContainer } from '../composables/useRouteContainer.ts'
import {
  useContainer,
  useSchemaContext
} from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { useStore } from '../composables/useStore.ts'
import defaultVerbs from '../verbs.js'
import { isSingleComponentView } from '../utils/schema/structure.js'
import { LoadingTracker } from '../utils/LoadingTracker.ts'

export default {
  name: 'DitoView',

  setup() {
    const adminContext = inject('adminContext')
    const router = useRouter()
    const parentRouteContext = inject('routeContext', null)
    useComponentPath(() => '')
    // NOTE: Each view has its own data, as `DitoRouterView` renders each route
    // record with its own component instance:
    const data = ref({})
    // The view displays its data as if it were an item of its source:
    const sourceSchema = computed(
      () => routeContainer.ownRouteContext.node.schema
    )
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
    const mainSourceContext = computed(() =>
      routeContainer.ownRouteContext.findSourceByDataPath(name.value)
    )
    const mainResourceContext = computed(
      () => mainSourceContext.value?.resourceContext ?? null
    )
    // The view is disabled while the requests of its components are pending:
    const loadingTracker = markRaw(
      new LoadingTracker(
        parentRouteContext?.loadingTracker ?? adminContext.loadingTracker
      )
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
        isDirty: computed(() => routeContainer.ownDataContext.isDirty),
        breadcrumb: computed(
          () => schema.value.breadcrumb || getLabel(schema.value)
        ),
        verbs: defaultVerbs,

        get dataModel() {
          return dataModel
        },

        get services() {
          return services
        },

        setData(value) {
          data.value = value
          return data.value
        }
      })
    )
    const { ownDataContext, ownRouteContext, store } = routeContainer
    provide('sourceSchema', sourceSchema)
    provide('sourceContext', mainSourceContext)
    provide('resourceContext', mainResourceContext)
    const { services, createDataModel } = useContainer({
      dataContext: ownDataContext,
      routeContext: ownRouteContext,

      get sourceContext() {
        return mainSourceContext.value
      },

      get resourceContext() {
        return mainResourceContext.value
      }
    })
    const { context } = useSchemaContext(
      reactive({ schema, data, dataPath: '' }),
      { services }
    )
    const { getLabel, shouldRenderSchema } = useSchemaValue(context)

    const dataModel = createDataModel({
      schema: () => schema.value,
      data: () => data.value,
      sourceSchema: () => sourceSchema.value
    })

    onMounted(() => {
      // Prevent bypassing of `if` by direct URL access:
      if (!shouldRenderSchema(schema.value)) {
        router.replace({ path: '/' })
      }
    })

    return {
      ...routeContainer,
      ...useStore({ store }),
      adminContext,
      routeContext: ownRouteContext,
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
