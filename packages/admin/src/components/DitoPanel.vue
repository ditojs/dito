<template lang="pug">
  ul.dito-panel.dito-layout-vertical(v-if="desc.components")
    li(
      v-for="(compDesc, key) in desc.components"
      v-show="getValue(compDesc, 'visible', true)"
    )
      dito-label(
        v-if="compDesc.label"
        :name="key"
        :text="compDesc.label"
      )
      component.dito-component(
        :is="typeToComponent(compDesc.type)"
        :desc="compDesc"
        :name="key"
        :data="data"
        :meta="meta"
        :disabled="getValue(compDesc, 'disabled', false) || disabled"
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

export default DitoComponent.component('dito-panel', {
  props: {
    desc: { type: Object, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    disabled: { type: Boolean, required: true }
  },

  methods: {
    isDisabled(desc) {

    },

    getValue(desc, name, defaultValue) {
      const value = desc[name]
      return value === undefined
        ? defaultValue
        : typeof value === 'function'
          ? value(this.data)
          : value
    }
  }
})
</script>
