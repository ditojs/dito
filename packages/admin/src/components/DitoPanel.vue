<template lang="pug">
  ul.dito-panel.dito-layout-vertical(v-if="desc.components")
    li(v-for="(comp, key) in desc.components")
      dito-label(
        v-if="comp.label"
        :name="key"
        :text="comp.label"
      )
      component.dito-component(
        :is="typeToComponent(comp.type)"
        :name="key"
        :desc="comp"
        :data="data"
        :meta="meta"
        :disabled="comp.disabled || disabled"
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
  }
})
</script>
