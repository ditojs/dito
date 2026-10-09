<template lang="pug">
//- The prefix or suffix of the input of a type component, see `schema.prefix`
//- and `schema.suffix`. The suffix also holds the clear button of clearable
//- components, and their info when they have no label to show it.
DitoAffixes(
  :items="typeComponent.schema[position]"
  :position="position"
  mode="input"
  :absolute="absolute"
  :clearable="shouldShowClearButton"
  :disabled="typeComponent.disabled"
  :inlineInfo="inlineInfo"
  :parentContext="typeComponent.context"
  @clear="typeComponent.clear()"
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

  props: {
    typeComponent: { type: Object, required: true },
    position: {
      type: String,
      required: true,
      validator: position => ['prefix', 'suffix'].includes(position)
    },
    absolute: { type: Boolean, default: false }
  },

  computed: {
    isSuffix() {
      return this.position === 'suffix'
    },

    shouldShowClearButton() {
      const { clearable, value } = this.typeComponent
      return this.isSuffix && clearable && value != null
    },

    inlineInfo() {
      // When a label is present, info is shown in the label component.
      // Otherwise, it's shown inline in the suffix.
      const { label, info } = this.typeComponent
      return this.isSuffix && !label ? info : null
    }
  }
})
</script>
