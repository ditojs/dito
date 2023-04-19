<template lang="pug">
UseSortable(
  v-if="draggable"
  :tag="tag"
  :modelValue="modelValue"
  :options="options"
  @update:modelValue="$emit('update:modelValue', $event)"
)
  slot
component(
  v-else
  :is="tag"
)
  slot
</template>

<script>
import DitoComponent from '../DitoComponent'
import { UseSortable } from '@vueuse/integrations/useSortable/component'

// @vue/component
export default DitoComponent.component('DitoDraggable', {
  components: { UseSortable },
  emits: ['update:modelValue'],

  props: {
    modelValue: {
      type: Array,
      required: true
    },
    tag: {
      type: String,
      default: 'div'
    },
    options: {
      type: Object,
      required: true
    },
    draggable: {
      type: Boolean,
      default: true
    }
  }
})
</script>
