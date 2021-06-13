<template lang="pug">
  .dito-section(
    :class="{ 'dito-section-labelled' : !!schema.label }"
  )
    dito-components.dito-section-components(
      v-if="components"
      :schema="{ components }"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :nested="nested"
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
import { getSchemaAccessor } from '@/utils/accessor'

// @vue/component
export default TypeComponent.register('section', {
  defaultValue: undefined,
  defaultNested: false,
  generateLabel: false,
  omitFlexGrow: true,

  computed: {
    components: getSchemaAccessor('components', {
      type: Object,
      default: {}
    })
  }
})
</script>
