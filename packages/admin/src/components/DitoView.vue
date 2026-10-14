<template lang="pug">
template(
  v-if="adminContext.user && shouldRenderSchema(schema)"
)
  //- NOTE: Unlike forms, views don't render while their nested routes show.
  DitoRouterView(
    v-if="!routeContext.isLastRoute"
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
      scrollable
      single
    )
</template>

<script>
import { computed, inject, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import {
  useRouteContainer,
  useRouteRecord
} from '../composables/useRouteContainer.ts'
import { useSchemaContext } from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { useStore } from '../composables/useStore.ts'
import defaultVerbs from '../verbs.js'
import { adminContextKey } from '../utils/keys.ts'
import { isSingleComponentView } from '../utils/schema/structure.js'

export default {
  setup() {
    const adminContext = inject(adminContextKey)
    const router = useRouter()
    const route = useRouteRecord()
    useComponentPath(() => '')
    // The view displays its data as if it were an item of its source:
    const sourceSchema = computed(() => route.node.value.schema)
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

    const { routeContext, dataContext, services, store, schemaPath } =
      useRouteContainer({
        route,
        schema: () => schema.value,
        sourceSchema: () => sourceSchema.value,
        // NOTE: Each view has its own data, as `DitoRouterView` renders each
        // route record with its own component instance:
        data: {},
        breadcrumb: () => schema.value.breadcrumb || getLabel(schema.value),
        verbs: () => defaultVerbs,
        // The view provides the source of its main component to the others:
        sourceContext: computed(
          () => (
            [...dataContext.sources].find(
              source => source.componentPath === name.value
            ) ?? null
          )
        )
      })
    const data = computed(() => dataContext.data)
    const { context } = useSchemaContext(
      reactive({ schema, data, dataPath: '' }),
      { services }
    )
    const { getLabel, shouldRenderSchema } = useSchemaValue(context)

    onMounted(() => {
      // Prevent bypassing of `if` by direct URL access:
      if (!shouldRenderSchema(schema.value)) {
        router.replace({ path: '/' })
      }
    })

    return {
      ...useStore({ store }),
      adminContext,
      routeContext,
      dataContext,
      schemaPath,
      schema,
      name,
      data,
      shouldRenderSchema
    }
  }
}
</script>
