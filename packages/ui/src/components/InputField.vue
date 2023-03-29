<template lang="pug">
.dito-input
  input(
    ref="input"
    :type="type"
    :id="id"
    :name="name"
    :title="title"
    :aria-label="title"
    v-bind="attributes"
    v-model="currentValue"
  )
</template>

<style lang="sass">
  @import '../styles/_imports'

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
    modelValue: { type: [String, Number], default: null },
    type: { type: String, default: 'text' },
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
      currentValue: this.modelValue,
      hovering: false,
      focused: false
    }
  },

  computed: {
    attributes() {
      // Remove 'onInput' handler because we're handling it separately below,
      // but pass on all others to the wrapped native element:
      const { onInput, ...attributes } = this.$attrs
      return attributes
    },

    size() {
      // Determine size based on min & max settings, if they're provided.
      const { size, min, max } = this.$attrs
      const getLength = value => value != null ? `${value}`.length : 0
      return size || getLength(min) || getLength(max) || undefined
    }
  },

  watch: {
    modelValue(to, from) {
      if (to !== from) {
        this.currentValue = to
      }
    },

    currentValue(currentValue) {
      if (currentValue !== this.modelValue) {
        this.$emit('update:modelValue', currentValue)
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
