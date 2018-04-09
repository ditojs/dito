<template lang="pug">
  type-list.dito-object(
    v-bind="$props"
    :isObject="true"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'
import ListMixin from '@/mixins/ListMixin'

export default TypeComponent.register('object', {
  processSchema: ListMixin.processSchema
})
</script>
