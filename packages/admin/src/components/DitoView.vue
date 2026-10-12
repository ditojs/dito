<template lang="pug">
template(
  v-if="admin.user && shouldRenderSchema(schema)"
)
  //- NOTE: Unlike forms, views don't render while their nested routes show.
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
  onMounted,
  provide,
  reactive,
  ref,
  useTemplateRef
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
import { getVerbs } from '../utils/services.ts'
import { isSingleComponentView } from '../utils/schema/structure.js'
import { LoadingTracker } from '../utils/LoadingTracker.ts'

export default {
  name: 'DitoView',

  setup() {
    const admin = inject('admin')
    const router = useRouter()
    const parentRoute = inject('route', null)
    useComponentPath(() => '')
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
    const { services, createDataModel } = useContainer({
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
