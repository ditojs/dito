<template lang="pug">
  .dito-input
    input(
      ref="input"
      v-model="currentValue"
      v-bind="attributes"
      v-on="listeners"
      :aria-label="title"
    )
</template>

<style lang="sass">
  .dito-input
    display: inline-block
    @extend %input
    input
      // Inherit all styling from .dito-input
      all: inherit
      display: inline-block
      width: 100%
      border: 0
      margin: 0
      padding: 0
</style>

<script>
export default {
  props: {
    type: { type: String, default: 'text' },
    value: { type: [String, Number], default: null },
    id: { type: String, default: null },
    name: { type: String, default: null },
    title: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    placeholder: { type: String, default: null },
    autocomplete: { type: String, default: 'off' }
    /*
    clearable: { type: Boolean, default: false }
    suffixIcon: { type: String, default: null },
    prefixIcon: { type: String, default: null }
    */
  },

  data() {
    return {
      currentValue: this.value,
      hovering: false,
      focused: false
    }
  },

  computed: {
    attributes() {
      const {
        id,
        name,
        type,
        size,
        title,
        disabled,
        readonly,
        placeholder,
        autocomplete,
        $attrs
      } = this
      return {
        id,
        name,
        type,
        size,
        title,
        disabled,
        readonly,
        placeholder,
        autocomplete,
        ...$attrs
      }
    },

    listeners() {
      // Remove 'input' listener because we're handling it separately below,
      // but pass on all others to the wrapped native element:
      const { input, ...listeners } = this.$listeners
      return listeners
    },

    size() {
      // Determine size based on min & max settings, if they're provided.
      const { size, min, max } = this.$attrs
      const getLength = value => value != null ? `${value}`.length : 0
      return size || getLength(min) || getLength(max) || undefined
    }
  },

  watch: {
    value(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.currentValue = newVal
      }
    },

    currentValue(newVal) {
      if (newVal !== this.value) {
        this.$emit('input', newVal)
      }
    }
  },

  methods: {
    focus() {
      this.$refs.input.focus()
    },

    blur() {
      this.$refs.input.blur()
    }
  }
}
</script>
