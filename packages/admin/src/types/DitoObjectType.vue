<template lang="pug">
.dito-object(
  v-if="isReady"
  :id="componentPath"
  ref="element"
  :class=`{
    'dito-object--text': !isInlined && !schema.component,
    'dito-object--empty': isEmpty
  }`
)
  .dito-object__content(
    v-if="objectData"
  )
    DitoSourceItem(
      :schema="schema"
      :formSchema="getItemFormSchema(schema, objectData, context)"
      :dataPath="dataPath"
      :data="objectData"
      :store="store"
      :disabled="disabled || isLoading"
      :collapsed="collapsed"
      :collapsible="collapsible"
      :deletable="deletable && !isHeadedByLabel"
      :headedByLabel="isHeadedByLabel"
      @delete="deleteItem(objectData)"
    )
      template(
        v-if="$slots.default"
        #default="{ context }"
      )
        slot(:context="context")
  //- Objects that the label of their field heads show all their buttons in its
  //- row, also their clipboard, which pastes into empty objects too. Empty
  //- objects without a label show them in their frame, the others in the
  //- header of their form, see `DitoSchema`:
  DitoLabelButtons(
    v-if="isHeadedByLabel || isInlined && !objectData"
    :labelId="isHeadedByLabel ? labelId : null"
  )
    DitoClipboard(
      v-if="schema.clipboard"
      :clipboard="schema.clipboard"
      :name="clipboardName"
      :label="labelText"
      :hasData="!!objectData"
      :getData="getClipboardData"
      :getUploadEntries="getClipboardUploadEntries"
      :createContext="createContext"
      :disabled="disabled || readonly || isLoading"
      @paste="pasteData"
    )
    DitoEditButtons(
      :buttons="buttonSchemas"
      :schema="schema"
      :dataPath="dataPath"
      :data="objectData"
      :store="store"
      :disabled="disabled || isLoading"
      :creatable="creatable"
      :createPath="sourceContext.createPath"
      :deletable="deletable"
      @delete="deleteItem(objectData)"
    )
  //- NOTE: Inlined objects only get the create button here, the other edit
  //- buttons are in `DitoSchemaInlined`.
  DitoEditButtons(
    v-else
    :buttons="buttonSchemas"
    :schema="schema"
    :dataPath="dataPath"
    :data="objectData"
    :store="store"
    :disabled="disabled || isLoading"
    :creatable="creatable"
    :createPath="sourceContext.createPath"
    :editable="editable"
    :editPath="sourceContext.objectPath"
    :deletable="!isInlined && deletable"
    @delete="deleteItem(objectData)"
  )
</template>

<script>
import { computed, inject, watchEffect } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { sourceTraits } from './traits.ts'
import { fieldProps } from '../composables/useField.ts'
import { useSource } from '../composables/useSource.ts'
import { useStore } from '../composables/useStore.ts'
import DitoSourceItem from '../components/DitoSourceItem.vue'
import DitoLabelButtons from '../components/DitoLabelButtons.vue'
import { resolveSchemaComponent } from '../utils/schema/setup.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'
import { getClipboardName } from '../utils/clipboard.js'
import { getUploadEntries } from '../utils/interchange.ts'
import { pasteData } from '../utils/pasteData.ts'
import { toClipboard } from '../utils/toClipboard.ts'
import { labelToggleKey } from '../utils/keys.ts'

// @vue/component
const DitoObjectType = {
  components: { DitoSourceItem, DitoLabelButtons },
  props: fieldProps,
  setup(props) {
    const source = useSource(props)
    const {
      context,
      services,
      sourceContext,
      isInlined,
      collapsible,
      collapsed,
      objectData,
      creatable,
      buttonSchemas
    } = source
    // The inlined form keeps whether it's open in the store of the object:
    const { getStoreRef } = useStore(props)
    const opened = getStoreRef('opened', () => !collapsed.value)
    // The label of the field heads inlined objects: its row holds their
    // buttons, and toggles them if they're collapsible, see `DitoSchema`:
    const isHeadedByLabel = computed(() => isInlined.value && !!props.labelId)
    // The buttons of objects, apart from the ones of their form:
    const hasButtons = computed(
      () => (
        creatable.value ||
        !!buttonSchemas.value ||
        isInlined.value && !!props.schema.clipboard
      )
    )
    // The frame of inlined objects isn't drawn while it holds nothing:
    // collapsed, or without data and buttons:
    const isEmpty = computed(
      () => (
        isInlined.value && (
          objectData.value
            ? isHeadedByLabel.value && !opened.value
            : isHeadedByLabel.value || !hasButtons.value
        )
      )
    )
    // Only objects with data have content to toggle:
    const labelToggle = inject(labelToggleKey)
    watchEffect(() => {
      labelToggle.value =
        isHeadedByLabel.value && collapsible.value && objectData.value
          ? {
              collapsed: !opened.value,
              toggle() {
                opened.value = !opened.value
              }
            }
          : null
    })
    // The form of the object, or of the data to paste into an empty one:
    const getForm = data => getItemFormSchema(props.schema, data, context)
    const getDataOptions = () => ({
      dataPath: props.dataPath,
      sourceSchema: props.schema,
      services,
      rootData: context.rootItem
    })
    return {
      ...source,
      isHeadedByLabel,
      hasButtons,
      isEmpty,
      getItemFormSchema,

      clipboardName: computed(() =>
        getClipboardName(getForm(objectData.value), props.schema)
      ),

      getClipboardData() {
        const data = objectData.value
        return toClipboard(getForm(data), props.schema, data, props.dataPath, {
          services,
          rootData: context.rootItem
        })
      },

      getClipboardUploadEntries(data) {
        return getUploadEntries(getForm(data), data, getDataOptions())
      },

      // Pasting into empty objects creates them first, as their create button
      // does:
      pasteData(clipboardData) {
        const form = getForm(objectData.value ?? clipboardData)
        const data = (
          objectData.value ??
          sourceContext.createItem(form, clipboardData.type ?? null)
        )
        return pasteData(form, data, clipboardData, getDataOptions())
      }
    }
  }
}

defineType({
  type: 'object',
  component: DitoObjectType,
  ...sourceTraits,
  sourceType: 'object',
  hasLabelButtons: true,
  alignsBelowLabels: false,

  async setupSchema({ schema, api, name }) {
    await Promise.all([
      resolveSchemaComponent(schema),
      sourceTraits.setupSchema({ schema, api, name })
    ])
  }
})

export default DitoObjectType
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-object {
  display: flex;
  border: $border-style;
  border-radius: $border-radius;
  margin: 0;
  padding: $form-spacing;
  box-sizing: border-box;
  min-width: min-content;
  // The frame closes with the content, as `TransitionHeight` does:
  transition-property: padding, border-width;
  transition-duration: 0.15s;
  transition-timing-function: $ease-out-quart;

  &__content {
    flex: 0 1 100%;
  }

  > .dito-edit-buttons {
    flex: 1 0 0%;
    margin-left: $form-spacing;
  }

  // The buttons of empty objects, like the ones in the footer of lists, aligned
  // by the padding of the frame instead of the inset of `DitoLabelButtons`:
  > .dito-label-buttons:last-child {
    margin: 0 0 0 auto;
  }

  // Align the text of rendered items with the text of their buttons:
  &--text {
    align-items: baseline;
  }

  // Frames with nothing in them aren't drawn, e.g. of collapsed objects, which
  // only show the label of their field:
  &--empty {
    padding: 0;
    border-width: 0;
  }
}
</style>
