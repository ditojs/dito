<template lang="pug">
  dito-tree-item.dito-tree(
    :data="value"
    :schema="schema"
    :root="true"
    :open="true"
    :childrenOpen="true"
  )
</template>

<style lang="sass">
.dito
  .dito-tree
    // Allow edit buttons to position themselves at the end of lines by default
    display: inline-block
</style>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('tree')
</script>
