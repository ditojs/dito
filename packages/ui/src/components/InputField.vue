<template lang="pug">
  .dito-input
    input(
      ref="input"
      :id="id"
      :name="name"
      :type="type"
      v-model="currentValue"
      v-bind="attributes"
      v-on="events"
      :aria-label="title"
    )
</template>

<style lang="sass">
  @import '../styles/imports'
  .dito-input
    @extend %input
    input
      // Inherit all styling from .dito-input
      all: inherit
      display: inline-block
      width: 100%
      border: 0
      margin: 0
      padding: 0
      &:focus
        outline: none
</style>

<script>
export default {
  props: {
    type: {
      type: String,
      default: 'text'
    },
    value: {
      type: [String, Number],
      default: null
    },
    id: String,
    name: String,
    disabled: Boolean,
    readonly: Boolean,
    title: String,
    placeholder: String,
    autocomplete: {
      type: String,
      default: 'off'
    },
    clearable: {
      type: Boolean,
      default: false
    }
    /*
    suffixIcon: String,
    prefixIcon: String
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
        title, disabled, readonly, placeholder, autocomplete, $attrs
      } = this
      return { title, disabled, readonly, placeholder, autocomplete, ...$attrs }
    },

    events() {
      // Remove 'input' event, but pass on all others.
      const { input, ...events } = this.$listeners
      return events
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
