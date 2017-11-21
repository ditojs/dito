<template lang="pug">
  ul.dito-panel(v-if="schema.components")
    template(v-for="(compSchema, key) in schema.components")
      li.dito-break(v-if="hasBreak(compSchema, 'before')")
      li(
        v-show="getValue(compSchema, 'visible', true)"
        :style="getStyle(compSchema)"
      )
        dito-label(
          :name="key"
          :text="getLabel(compSchema, key)"
        )
        component.dito-component(
          :is="getTypeComponent(compSchema.type)"
          :schema="compSchema"
          :name="key"
          :data="data"
          :meta="meta"
          :store="getStore(key)"
          :disabled="getValue(compSchema, 'disabled', false) || disabled"
          :class="{ \
            'dito-fill': hasFill(compSchema), \
            'dito-has-errors': errors.has(key) \
          }"
        )
        dito-errors(
          v-if="errors.has(key)"
          :name="key"
        )
      li.dito-break(v-if="hasBreak(compSchema, 'after')")
</template>

<style lang="sass">
.dito
  ul.dito-panel
    display: flex
    flex-flow: row wrap
    align-items: baseline
    > li
      flex: 1 0 auto
      align-self: stretch
      box-sizing: border-box
      padding: $form-spacing
      .dito-fill
        display: block
        width: 100%
      &.dito-break
        padding: 0
        width: 100%
    border-bottom: $border-style
    padding-bottom: $form-margin
    margin-bottom: $form-margin
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { isString, isFunction } from '@/utils'

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
    },

    hasBreak(schema, type) {
      return [type, 'both'].includes(schema.break)
    },

    hasFill(schema) {
      const { fill, break: _break, width } = schema
      return fill || _break || width && parseFloat(width) > 0
    },

    getStyle(schema) {
      const { width } = schema
      if (width) {
        const value = parseFloat(width)
        const percent = isString(width) && /%/.test(width) ? value : value * 100
        return `flex-basis: ${Math.floor(percent * 100) / 100}%;`
      }
    }
  }
})
</script>
