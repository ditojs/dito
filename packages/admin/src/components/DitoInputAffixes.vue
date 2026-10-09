<template lang="pug">
//- The prefix or suffix of the input of a type component, see `schema.prefix`
//- and `schema.suffix`, and `getInputAffixesProps()` for their props. The
//- suffix also holds the clear button of clearable components, and their info
//- when they have no label to show it.
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
import DitoComponent from '../DitoComponent.js'
import DitoAffixes from './DitoAffixes.vue'

// @vue/component
export default DitoComponent.component('DitoInputAffixes', {
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
    // The context of the type component, for the callbacks of the items.
    parentContext: { type: Object, required: true }
  }
})
</script>
