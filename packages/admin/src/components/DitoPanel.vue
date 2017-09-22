<template lang="pug">
  ul.dito-panel.dito-layout-vertical(v-if="schema.components")
    li(
      v-for="(compSchema, key) in schema.components"
      v-show="getValue(compSchema, 'visible', true)"
    )
      dito-label(
        :name="key"
        :text="getLabel(compSchema, key)"
      )
      component(
        :is="getTypeComponent(compSchema.type)"
        :schema="compSchema"
        :name="key"
        :data="data"
        :meta="meta"
        :store="getStore(key)"
        :disabled="getValue(compSchema, 'disabled', false) || disabled"
        :class="{ 'dito-has-errors': errors.has(key) }"
      )
      dito-errors(
        v-if="errors.has(key)"
        :name="key"
      )
</template>

<style lang="sass">
.dito
  .dito-panel
    width: 100%
    border-spacing: 0 $form-spacing
    border-bottom: $border-style
    padding-bottom: $form-margin - $form-spacing
    margin-bottom: $form-margin - $form-spacing
</style>

<script>
import DitoComponent from '@/DitoComponent'
import {isFunction} from '@/utils'

export default DitoComponent.component('dito-panel', {
  inject: ['$validator'],

  props: {
    schema: { type: Object, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true }
  },

  methods: {
    getValue(schema, name, defaultValue) {
      const value = schema[name]
      return value === undefined
        ? defaultValue
        : isFunction(value)
          ? value(this.data)
          : value
    }
  }
})
</script>
