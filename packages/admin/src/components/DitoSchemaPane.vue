<template lang="pug">
DitoPaneRows(
  v-if="dataContext.hasData && (entries.length > 0 || $slots.default)"
  :id="tabPanelId"
  :role="tab ? 'tabpanel' : null"
  :aria-labelledby="tabId"
  :class="classes"
  :entries="entries"
  :data="data"
  :single="isSingleComponent"
  :disabled="disabled"
  :compact="compact"
  :generateLabels="generateLabels"
)
  //- The component of sections that lay out their components:
  template(
    v-if="$slots.default"
    #default
  )
    slot
</template>

<script>
import { computed, inject, provide, unref } from 'vue'
import SchemaContext from '../SchemaContext.js'
import { useServices } from '../composables/useSchemaContext.ts'
import { useStore } from '../composables/useStore.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { getRootData } from '../utils/services.ts'
import { appendDataPath } from '../utils/data.js'
import {
  isLabelled,
  isCompact,
  hasNestedData,
  isInlined
} from '../utils/schema/structure.js'
import { shouldRenderSchema } from '../utils/schema/data.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'
import { getItemAdapter } from '../utils/schema/types.ts'
import { layoutKey, panelTabKey, sourceSchemaKey } from '../utils/keys.ts'

export default {
  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, default: '' },
    data: { type: Object, default: null },
    store: { type: Object, required: true },
    tab: { type: String, default: null },
    selected: { type: Boolean, default: false },
    single: { type: Boolean, default: false },
    padding: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false }
  },

  setup(props, { slots }) {
    const services = useServices()
    const { getChildStore } = useStore(props)
    const sourceSchema = inject(sourceSchemaKey, null)
    // Tabs add their name, as they don't appear in data paths:
    const { componentPath, parentComponentPath } = useComponentPath(
      () => props.dataPath,
      parent =>
        props.tab ? appendDataPath(parent.path, props.tab) : parent.path
    )
    if (props.tab) {
      provide(panelTabKey, {
        tabName: props.tab,
        isTabSelected: () => props.selected
      })
    }

    // NOTE: The schema can be null while multi-form lists load their data. The
    // value of an item adapter keeps the item's data path in inlined items, as
    // their list holds its errors. Routed forms edit a draft of the item:
    const componentSchemas = computed(() => {
      const source = unref(sourceSchema)
      const itemAdapter =
        source && isInlined(source) ? getItemAdapter(source) : null
      return Object.entries(props.schema?.fields || {}).map(
        ([name, schema]) => {
          // The schema may be used elsewhere too:
          schema = { ...schema, name }
          const nested = hasNestedData(schema)
          const nestedDataPath = appendDataPath(props.dataPath, name)
          const dataPath =
            nested && name !== itemAdapter?.name
              ? nestedDataPath
              : props.dataPath
          return {
            schema,
            dataPath,
            nestedDataPath,
            // The data path of `data`, also of wrapped values:
            itemDataPath: props.dataPath,
            nested,
            store: getChildStore(name)
          }
        }
      )
    })

    const isSingleComponent = computed(
      () => props.single && componentSchemas.value.length === 1
    )

    const contexts = computed(() =>
      componentSchemas.value.map(({ schema, nested, dataPath, itemDataPath }) =>
        SchemaContext.createForSchema(services, {
          schema,
          name: schema.name,
          nested,
          data: props.data,
          dataPath,
          itemDataPath,
          rootData: getRootData(services)
        })
      )
    )

    // Evaluate the `if` of the components before they're rendered:
    const shouldRenderComponentByIndex = computed(() =>
      componentSchemas.value.map(({ schema }, index) =>
        shouldRenderSchema(schema, contexts.value[index])
      )
    )

    // Also of type components that render their own label, and of sections
    // and inlined objects whose forms show labels. NOTE: We only look one
    // level deep, and a label anywhere in the nested form counts, not only in
    // its first row, as rows are only known once the nested pane is measured:
    const isLabelledByIndex = computed(() =>
      componentSchemas.value.map(({ schema, nested }, index) => {
        const isFormLabelled = () => {
          const item = nested ? props.data?.[schema.name] : props.data
          const form = getItemFormSchema(schema, item, contexts.value[index])
          return Object.values(form.fields || {}).some(component =>
            isLabelled(component, !isCompact(form))
          )
        }
        return (
          isLabelled(schema, props.generateLabels) ||
          isInlined(schema) && isFormLabelled()
        )
      })
    )

    // The components as the rows and layouts place them:
    const entries = computed(() =>
      componentSchemas.value.map((entry, index) => ({
        ...entry,
        shouldRender: shouldRenderComponentByIndex.value[index],
        isLabelled: isLabelledByIndex.value[index]
      }))
    )

    // Layout sections place the entries with `DitoSchemaField` and `DitoPane`,
    // and nested panes end the layout above them:
    provide(
      layoutKey,
      slots.default
        ? {
            props,
            componentPath,
            entries,
            getEntry(name) {
              const entry = entries.value.find(
                ({ schema }) => schema.name === name
              )
              if (!entry) {
                throw new Error(`Unknown component: '${name}'.`)
              }
              return entry
            }
          }
        : null
    )

    return {
      dataContext: services.dataContext,
      entries,
      isSingleComponent,

      // See `DitoTabs.getTabId()` and `getTabPanelId()`:
      tabId: computed(() =>
        props.tab ? `${parentComponentPath.value}-tab-${props.tab}` : null
      ),

      tabPanelId: computed(() =>
        props.tab ? `${parentComponentPath.value}-tabpanel-${props.tab}` : null
      ),

      classes: computed(() => {
        const prefix = 'dito-pane'
        return {
          [`${prefix}--single`]: isSingleComponent.value,
          [`${prefix}--padding-${props.padding}`]: !!props.padding
        }
      })
    }
  }
}
</script>
