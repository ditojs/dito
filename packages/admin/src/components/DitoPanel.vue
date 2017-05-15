<template lang="pug">
  ul.dito-panel.dito-table(v-if="desc.components")
    li(v-for="(comp, key) in desc.components")
      dito-label(
        v-if="comp.label",
        :name="key",
        :text="comp.label"
      )
      .dito-container
        component.dito-component(
          :is="typeToComponent(comp.type)",
          :name="key",
          :desc="comp",
          :data="data",
          :meta="meta",
          :disabled="comp.disabled || disabled",
          :class="{ 'dito-has-errors': errors.has(key) }"
        )
        dito-errors(
          v-if="errors.has(key)",
          :name="key"
        )
</template>

<style lang="sass">
.dito
  ul.dito-panel
    border-spacing: 0 0.5em
    padding-bottom: 0.5em
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
