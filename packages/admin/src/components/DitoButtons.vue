<template lang="pug">
.dito-buttons(
  v-if="buttonSchemas || hasSlotContent($slots.default)"
)
  template(
    v-for="(buttonSchema, buttonDataPath) in buttonSchemas"
  )
    DitoContainer(
      v-if="shouldRender(buttonSchema)"
      :key="buttonDataPath"
      :schema="buttonSchema"
      :dataPath="buttonDataPath"
      :data="data"
      :meta="meta"
      :store="getChildStore(buttonSchema.name)"
      :disabled="disabled"
      :generateLabels="false"
    )
  template(
    v-for="vnode of $slots.default?.()"
  )
    //- Render each node in the default slot through `dito-vnode`,
    //- so it can be wrapped in a `.dito-container` class.
    .dito-container(
      v-if="hasVNodeContent(vnode)"
    )
      DitoVnode(:vnode="vnode")
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { appendDataPath } from '../utils/data.js'
import { hasSlotContent, hasVNodeContent } from '../utils/vue.js'

// @vue/component
export default DitoComponent.component('DitoButtons', {
  provide: {
    $tabComponent: () => null
  },

  props: {
    buttons: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: [Object, Array], default: null },
    meta: { type: Object, default: () => ({}) },
    store: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false }
  },

  computed: {
    buttonSchemas() {
      // Compute a buttons list which has the dataPath baked into its keys.
      const { dataPath, buttons } = this
      return buttons
        ? Object.values(buttons).reduce((schemas, button) => {
            schemas[appendDataPath(dataPath, button.name)] = button
            return schemas
          }, {})
        : null
    }
  },

  methods: {
    hasSlotContent,
    hasVNodeContent
  }
})
</script>

<style lang="sass">
.dito-buttons
  > .dito-container
    padding: 0
</style>
