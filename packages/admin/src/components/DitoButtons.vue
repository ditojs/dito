<template lang="pug">
  .dito-buttons
    // Add `.dito-schema-content` for handling of max-width and rules,
    // see `.dito-schema-content::before` in DitoSchema.
    .dito-schema-content
      component.dito-component(
        v-for="(buttonSchema, buttonDataPath) in buttonSchemas"
        v-if="shouldRender(buttonSchema)"
        :key="buttonDataPath"
        :is="getTypeComponent(buttonSchema.type)"
        :schema="buttonSchema"
        :dataPath="buttonDataPath"
        :data="data"
        :meta="meta"
        :store="store"
        :params="params"
        :disabled="disabled || isDisabled(buttonSchema)"
        :class=`{
          'dito-disabled': disabled || isDisabled(buttonSchema),
          'dito-has-errors': $errors.has(buttonDataPath)
        }`
      )
</template>

<script>
import DitoComponent from '@/DitoComponent'

// @vue/component
export default DitoComponent.component('dito-buttons', {
  inject: ['$validator'],

  props: {
    buttons: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, default: () => ({}) },
    store: { type: Object, default: () => ({}) },
    params: { type: Object, default: null },
    disabled: { type: Boolean, default: false }
  },

  computed: {
    buttonSchemas() {
      // Compute a buttons list which has the dataPath baked into its keys.
      const { dataPath, buttons } = this
      return Object.values(buttons || {}).reduce((schemas, button) => {
        schemas[this.appendDataPath(dataPath, button.name)] = button
        return schemas
      }, {})
    }
  }
})
</script>
