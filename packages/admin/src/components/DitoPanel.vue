<template lang="pug">
  ul.dito-panel(v-if="schema.components")
    template(v-for="(compSchema, key) in schema.components")
      li.dito-break(v-if="compSchema.break === 'before'")
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
            'dito-has-errors': $errors.has(key) \
          }"
        )
        dito-errors(
          v-if="$errors.has(key)"
          :name="key"
        )
      li.dito-break(v-if="compSchema.break === 'after'")
</template>

<style lang="sass">
.dito
  ul.dito-panel
    display: flex
    flex-flow: row wrap
    align-items: baseline
    margin: -$form-spacing
    > li
      flex: 1 0 auto
      align-self: stretch
      box-sizing: border-box
      padding: $form-spacing
      > .dito-fill
        display: block
        width: 100%
      &.dito-break
        padding: 0
        width: 100%
    &::after
      // Use a pseudo element to display a ruler with proper margins
      display: 'block'
      content: ''
      width: 100%
      padding-bottom: $form-margin
      border-bottom: $border-style
      // Add removed $form-spacing again to the ruler
      margin: 0 $form-spacing $form-margin
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { isString, isFunction } from '@/utils'

export default DitoComponent.component('dito-panel', {
  inject: ['$validator'],

  props: {
    schema: { type: Object, required: true },
    name: { type: String },
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

    hasFill(schema) {
      return this.getPercentage(schema) > 0
    },

    getPercentage(schema) {
      const { width } = schema
      const value = parseFloat(width)
      return isString(width) && /%/.test(width) ? value : value * 100
    },

    getStyle(schema) {
      const percentage = this.getPercentage(schema)
      return percentage && `flex-basis: ${percentage}%;`
    },

    focus() {
      if (this.name) {
        this.$router.push({ hash: this.name })
      }
    }
  }
})
</script>
