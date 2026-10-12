<template lang="pug">
//- The suffix also holds the clear button of clearable components, and their
//- info when they have no label to show it.
DitoAffixes(
  :items="items"
  :position="position"
  mode="input"
  :absolute="absolute"
  :clearable="clearable"
  :hasValue="hasValue"
  :disabled="disabled"
  :inlineInfo="inlineInfo"
  :parentContext="parentContext"
  @clear="$emit('clear')"
)
  template(
    v-if="$slots.append"
    #append
  )
    slot(name="append")
</template>

<script>
import DitoAffixes from './DitoAffixes.vue'

export default {
  components: { DitoAffixes },
  emits: ['clear'],

  props: {
    position: {
      type: String,
      required: true,
      validator: position => ['prefix', 'suffix'].includes(position)
    },
    items: { type: [String, Object, Array], default: null },
    absolute: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    clearable: { type: Boolean, default: false },
    hasValue: { type: Boolean, default: false },
    inlineInfo: { type: String, default: null },
    // For the callbacks of the items:
    parentContext: { type: Object, required: true }
  }
}
</script>
