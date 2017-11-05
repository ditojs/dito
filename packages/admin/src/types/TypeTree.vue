<template lang="pug">
  dito-tree.dito-tree(
    :data="value"
    :root="true"
    :open="true"
    :childrenOpen="true"
  )
</template>

<style lang="sass">
.dito
  .dito-tree
</style>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('tree')
</script>
