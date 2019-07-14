<template lang="pug">
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

<script>
import TypeComponent from '@/TypeComponent'

// @vue/component
export default TypeComponent.register('section', {
  flattenedType: true,
  defaultValue: undefined,
  generateLabel: false,
  omitFlexGrow: true,
  omitPadding: true
})
</script>
