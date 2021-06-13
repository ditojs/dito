<template lang="pug">
  .dito-section(
    :class="{ 'dito-section-labelled' : !!schema.label }"
  )
    dito-components.dito-section-components(
      v-if="schema.components"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
</template>

<style lang="sass">
  .dito-section
    &.dito-section-labelled
      border: $border-style
      border-radius: $border-radius
      padding: $form-spacing
      box-sizing: border-box
</style>

<script>
import TypeComponent from '@/TypeComponent'

// @vue/component
export default TypeComponent.register('section', {
  defaultValue: undefined,
  generateLabel: false,
  omitFlexGrow: true,
  unnested: schema => schema.nested !== true,
  omitPadding: schema => !schema.label
})
</script>
