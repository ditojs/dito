<template lang="pug">
template(
  v-if="adminContext.user && shouldRenderSchema(schema)"
)
  DitoRouterView(
    v-if="!isActiveRoute"
    :routeLevel="routeContext.level + 1"
  )
  //- NOTE: `v-show` keeps views alive while the forms of their items show, as
  //- their sources claim the forms' routes, like in forms:
  .dito-view.dito-scroll-parent(
    v-show="isActiveRoute"
    :data-resource="schemaPath"
  )
    //- The component of pages, in the place of the view's schema. The form of
    //- `useDitoForm()` renders as the page's schema, see `DitoSchemaForm`:
    .dito-view__page(
      v-if="isPage"
      :class="pageClasses"
    )
      component(:is="sourceSchema.component")
    DitoSchema(
      v-else
      :key="name"
      :schema="schema"
      :data="data"
      :store="getChildStore(name)"
      padding="root"
      :active="isActiveRoute"
      scrollable
      single
    )
</template>

<script>
import { computed, inject, onMounted, provide, reactive } from 'vue'
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
import { adminContextKey, schemaContextKey } from '../utils/keys.ts'
import {
  isPage,
  isSingleFieldView
} from '../utils/schema/structure.js'

export default {
  setup() {
    const adminContext = inject(adminContextKey)
    const router = useRouter()
    const route = useRouteRecord()
    useComponentPath(() => '')
    // The view displays its data as if it were an item of its source:
    const sourceSchema = computed(() => route.node.value.schema)
    const schema = computed(() => {
      const { field, ...schema } = sourceSchema.value
      // Render single-field views as views with that field:
      return isSingleFieldView(sourceSchema.value)
        ? {
            ...schema,
            fields: {
              [schema.name]: {
                name: schema.name,
                label: false,
                ...field
              }
            }
          }
        : schema
    })
    const name = computed(() => schema.value.name)
    const isPageView = computed(() => isPage(sourceSchema.value))

    const { routeContext, dataContext, services, store, schemaPath } =
      useRouteContainer({
        route,
        schema: () => schema.value,
        sourceSchema: () => sourceSchema.value,
        // NOTE: Each view has its own data, as `DitoRouterView` renders each
        // route record with its own component instance:
        data: {},
        breadcrumb: () => schema.value.breadcrumb || getLabelText(schema.value),
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
    const { getLabelText, shouldRenderSchema } = useSchemaValue(context)
    // Pages render without the view's schema, whose context they read:
    provide(schemaContextKey, context)

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
      sourceSchema,
      schema,
      name,
      data,
      isPage: isPageView,
      // Without a form, the page scrolls its content itself:
      pageClasses: computed(() =>
        routeContext.componentForm
          ? 'dito-scroll-parent'
          : 'dito-view__page--content dito-scroll'
      ),
      isActiveRoute: computed(() => routeContext.isActive),
      shouldRenderSchema
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-view__page--content {
  padding: $content-padding;
}
</style>
