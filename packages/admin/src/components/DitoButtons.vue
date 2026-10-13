<template lang="pug">
.dito-buttons(
  v-if="buttonSchemas || hasSlotContent($slots.default)"
)
  template(
    v-for="(buttonSchema, buttonDataPath) in buttonSchemas"
  )
    DitoContainer.dito-buttons__container(
      v-if="shouldRenderButton(buttonSchema, buttonDataPath)"
      :key="buttonDataPath"
      :schema="buttonSchema"
      :dataPath="buttonDataPath"
      :data="data"
      :itemDataPath="itemDataPath"
      :nested="nested"
      :store="getChildStore(buttonSchema.name)"
      :disabled="disabled"
    )
  template(
    v-for="vnode of $slots.default?.()"
  )
    //- Wrap each node of the default slot in a `.dito-container`:
    .dito-container.dito-buttons__container(
      v-if="hasVNodeContent(vnode)"
    )
      DitoVNode(:vnode="vnode")
</template>

<script>
import { computed, provide } from 'vue'
import { hasSlotContent, hasVNodeContent } from '@ditojs/ui/src'
import SchemaContext from '../SchemaContext.js'
import { useServices } from '../composables/useSchemaContext.ts'
import { useStore } from '../composables/useStore.ts'
import {
  continueComponentPath,
  useComponentPath
} from '../composables/useComponentPath.ts'
import { appendDataPath } from '../utils/data.js'
import { shouldRenderSchema } from '../utils/schema/data.js'
import { getRootData } from '../utils/services.ts'
import { panelTabKey } from '../utils/keys.ts'

export default {
  props: {
    buttons: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: [Object, Array], default: null },
    // The data path of `data`, e.g. of the item that holds the list of list
    // buttons:
    itemDataPath: { type: String, default: props => props.dataPath },
    store: { type: Object, default: () => ({}) },
    nested: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    buttonsName: { type: String, default: 'buttons' }
  },

  setup(props) {
    // Buttons don't belong to the tab of a pane:
    provide(panelTabKey, null)
    // Add the group name, so buttons don't share their component paths with
    // components of the same name, like a `publish` button and field:
    useComponentPath(
      () => props.dataPath,
      parent =>
        appendDataPath(
          continueComponentPath(parent, props.dataPath),
          `$${props.buttonsName}`
        )
    )
    const services = useServices()
    return {
      ...useStore(props),
      hasSlotContent,
      hasVNodeContent,

      // Evaluate the `if` of each button with its own context, as rendered:
      shouldRenderButton(schema, dataPath) {
        return shouldRenderSchema(
          schema,
          SchemaContext.createForSchema(services, {
            schema,
            name: schema.name,
            nested: props.nested,
            data: props.data,
            dataPath,
            itemDataPath: props.itemDataPath,
            rootData: getRootData(services)
          })
        )
      },

      // The buttons by their data paths:
      buttonSchemas: computed(() => {
        const { dataPath, buttons } = props
        return buttons
          ? Object.fromEntries(
              Object.values(buttons).map(button => [
                appendDataPath(dataPath, button.name),
                button
              ])
            )
          : null
      })
    }
  }
}
</script>

<style lang="scss">
.dito-buttons {
  // The containers of the buttons don't add padding around them.
  --container-padding: 0px;
}
</style>
