<template lang="pug">
  type-list.dito-object(v-bind="$props")
</template>

<script>
import TypeComponent from '@/TypeComponent'
import SourceMixin from '@/mixins/SourceMixin'

export default TypeComponent.register('object', {
  processSchema: SourceMixin.processSchema
})
</script>
