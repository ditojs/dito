<template lang="pug">
  dito-components.dito-section-components(
    v-if="schema.components"
    :schema="schema"
    :dataPath="parentDataPath"
    :data="data"
    :meta="meta"
    :store="parentStore"
    :disabled="disabled"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

// @vue/component
export default TypeComponent.register('section')
</script>
