<template lang="pug">
.dito-buttons(
  v-if="buttonSchemas || hasSlotContent($slots.default)"
)
  template(
    v-for="(buttonSchema, buttonDataPath) in buttonSchemas"
  )
    DitoContainer.dito-buttons__container(
      v-if="shouldRenderSchema(buttonSchema)"
      :key="buttonDataPath"
      :schema="buttonSchema"
      :dataPath="buttonDataPath"
      :data="data"
      :meta="meta"
      :nested="nested"
      :store="getChildStore(buttonSchema.name)"
      :disabled="disabled"
    )
  template(
    v-for="vnode of $slots.default?.()"
  )
    //- Render each node in the default slot through `dito-vnode`,
    //- so it can be wrapped in a `.dito-container` class.
    .dito-container.dito-buttons__container(
      v-if="hasVNodeContent(vnode)"
    )
      DitoVnode(:vnode="vnode")
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import ContextMixin from '../mixins/ContextMixin.js'
import { appendDataPath } from '../utils/data.js'
import { hasSlotContent, hasVNodeContent } from '@ditojs/ui/src'

// @vue/component
export default DitoComponent.component('DitoButtons', {
  mixins: [ContextMixin],

  provide: {
    $tabComponent: () => null
  },

  props: {
    buttons: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: [Object, Array], default: null },
    meta: { type: Object, default: () => ({}) },
    store: { type: Object, default: () => ({}) },
    nested: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    // The name of the group of buttons, e.g. `panelButtons`, see
    // `componentPath`.
    buttonsName: { type: String, default: 'buttons' }
  },

  computed: {
    componentPath() {
      // Add the name of the group, so that buttons don't share their component
      // paths with components of the same name, e.g. a `publish` button with a
      // `publish` field, as component paths are used for registries.
      return appendDataPath(
        this.continueParentComponentPath(),
        `$${this.buttonsName}`
      )
    },

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

<style lang="scss">
.dito-buttons {
  > .dito-container {
    padding: 0;
  }
}
</style>
