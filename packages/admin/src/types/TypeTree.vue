<template lang="pug">
  .dito-tree
    dito-scopes(
      v-if="scopes"
      :query="query"
      :scopes="scopes"
    )
    dito-tree-item(
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
import ListMixin from '@/mixins/ListMixin'

export default TypeComponent.register('tree', {
  mixins: [ListMixin]
})
</script>
