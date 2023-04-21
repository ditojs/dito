<template lang="pug">
.dito-input
  slot(name="before")
  input(
    :id="id"
    ref="input"
    v-model="currentValue"
    :type="type"
    :name="name"
    :title="title"
    :disabled="disabled"
    :readonly="readonly"
    :autofocus="autofocus"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :aria-label="title"
    v-bind="$attrs"
  )
  slot(name="after")
</template>

<script>
export default {
  emits: ['update:modelValue'],

  props: {
    modelValue: { type: [String, Number], default: null },
    type: { type: String, default: 'text' },
    id: { type: String, default: null },
    name: { type: String, default: null },
    title: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    autofocus: { type: Boolean, default: false },
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
    size() {
      // Determine size based on min & max settings, if they're provided.
      const { size, min, max } = this.$attrs
      const getLength = value => (value != null ? `${value}`.length : 0)
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

<style lang="scss">
@import '../styles/_imports';

.dito-input {
  display: inline-block;
  position: relative;

  @extend %input;

  input {
    // Inherit all styling from .dito-input
    all: inherit;
    display: inline-block;
    width: 100%;
    border: 0;
    margin: 0;
    padding: 0;
  }
}
</style>
