<template lang="pug">
//- The props of `reka-ui`'s `TimeFieldRoot` fall through to it:
TimeFieldRoot.dito-time-input.dito-input(
  v-slot="{ segments }"
  :locale="locale"
  :class="classes"
)
  slot(name="prefix")
  .dito-date-segments
    TimeFieldInput.dito-date-segments__part(
      v-for="item in segments"
      :key="item.part"
      :part="item.part"
    ) {{ item.value }}
  slot(name="suffix")
</template>

<script>
import { TimeFieldInput, TimeFieldRoot } from 'reka-ui'

// A time field, built on reka-ui's `TimeField`, see `docs/api/ui.md`.
export default {
  components: { TimeFieldInput, TimeFieldRoot },

  props: {
    locale: { type: String, default: 'en-US' }
  },

  computed: {
    classes() {
      return {
        // Like `DitoInput`:
        'dito-input--has-errors': ![null, false, 'false', ''].includes(
          this.$attrs['aria-invalid'] ?? null
        ),
        'dito-input--disabled': this.$attrs.disabled
      }
    }
  },

  methods: {
    focus() {
      this.$el.querySelector('[contenteditable="true"]')?.focus()
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
