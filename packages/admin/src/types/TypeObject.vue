<template lang="pug">
  // NOTE: Rendering is delegated to TypeList, simply by passing on all params.
  // This works because SourceMixin is equipped to handle both types.
  type-list.dito-object(v-bind="$props")
</template>

<script>
import TypeComponent from '@/TypeComponent'
import SourceMixin from '@/mixins/SourceMixin'

export default TypeComponent.register('object', {
  // We only inject SourceMixin because we need SourceMixin.processSchema()
  // Everything else gets handled by the wrapped TypeList.
  mixins: [SourceMixin],
  // Mark as an object source, see schema.js
  isObjectSource: true
})
</script>
