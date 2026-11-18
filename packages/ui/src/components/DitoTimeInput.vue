<template lang="pug">
//- The props of `reka-ui`'s `TimeFieldRoot` fall through to it:
TimeFieldRoot.dito-time-input.dito-input(
  v-slot="{ segments }"
  :locale="locale"
  :disabled="disabled"
  :class="classes"
)
  slot(name="prefix")
  .dito-date-segments
    TimeFieldInput.dito-date-segments__part(
      v-for="item in segments"
      ref="parts"
      :key="item.part"
      :part="item.part"
      :class="getSegmentClasses(item)"
    ) {{ item.value }}
  slot(name="suffix")
</template>

<script>
import { TimeFieldInput, TimeFieldRoot } from 'reka-ui'
import { hasErrors } from '../utils/element.js'
import { focusSegment, getSegmentClasses } from './dateSegments.js'

// A time field, built on reka-ui's `TimeField`.
export default {
  components: { TimeFieldInput, TimeFieldRoot },

  props: {
    locale: { type: String, default: 'en-US' },
    disabled: { type: Boolean, default: false }
  },

  computed: {
    classes() {
      return {
        'dito-input--has-errors': hasErrors(this.$attrs),
        'dito-input--disabled': this.disabled
      }
    }
  },

  methods: {
    getSegmentClasses,

    focus() {
      focusSegment(this.$refs.parts)
    },

    blur() {
      this.$el.querySelector(':focus')?.blur()
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-time-input {
  display: flex;
  min-width: 6em;
}
</style>
