<template lang="pug">
  ul.dito-panel(
    v-if="components"
  )
    template(
      v-for="(compSchema, key) in components"
    )
      li.dito-break(
        v-if="compSchema.break === 'before'"
      )
      li.dito-container(
        v-show="getValue(compSchema, 'visible', true)"
        :style="getStyle(compSchema)"
        :key="key"
      )
        dito-label(
          :name="key"
          :text="getLabel(compSchema)"
        )
        component.dito-component(
          :is="getTypeComponent(compSchema.type)"
          :schema="compSchema"
          :name="key"
          :data="data"
          :meta="meta"
          :store="getOrCreateStore(key)"
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
      li.dito-break(
        v-if="compSchema.break === 'after'"
      )
</template>

<style lang="sass">
$half-spacing: $form-spacing / 2
.dito
  .dito-panel
    display: flex
    flex-flow: row wrap
    position: relative
    align-items: baseline
    margin: (-$form-spacing) (-$half-spacing)
    &::after
      // Use a pseudo element to display a ruler with proper margins
      display: 'block'
      content: ''
      width: 100%
      padding-bottom: $form-margin
      border-bottom: $border-style
      // Add removed $form-spacing again to the ruler
      margin: 0 $half-spacing $form-margin
  .dito-container
    flex: 1 0 auto
    align-self: stretch
    position: relative // for .dito-errors
    box-sizing: border-box
    // Cannot use margin here as it needs to be part of box-sizing for
    // percentages in flex-basis to work.
    padding: $form-spacing $half-spacing
    .dito-component.dito-fill
      display: block
      width: 100%
  .dito-break
    padding: 0
    width: 100%
  .dito-list
    .dito-panel
      &::after
        // Hide the ruler in nested forms
        display: none
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { isFunction } from '@/utils'

export default DitoComponent.component('dito-panel', {
  inject: ['$validator'],

  props: {
    schema: { type: Object },
    hash: { type: String },
    prefix: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true }
  },

  computed: {
    components() {
      // Compute a components list which has the prefix baked into its keys and
      // adds the key as the name to each component, used for labels etc.
      // NOTE: schema can be null while multi-form lists load their data.
      const {
        schema: {
          components = {}
        } = {}
      } = this
      const prefixed = {}
      for (const [name, compSchema] of Object.entries(components)) {
        prefixed[`${this.prefix}${name}`] = {
          name,
          ...compSchema
        }
      }
      return prefixed
    }
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
      return width === 'auto' ? null // auto = no fitting
        : !width ? 100 // default = 100%
        : /%/.test(width) ? parseFloat(width) // percentage
        : width * 100 // fraction
    },

    getStyle(schema) {
      const percentage = this.getPercentage(schema)
      return percentage && `flex-basis: ${percentage}%;`
    },

    focus() {
      const { hash } = this
      if (hash) {
        this.$router.push({ hash })
      }
    }
  }
})
</script>
