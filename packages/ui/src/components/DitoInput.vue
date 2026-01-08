<template lang="pug">
.dito-input(
  :class="classes"
  @mousedown.prevent="onMouseDown"
)
  slot(name="prefix")
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
    v-bind="attributes"
  )
  slot(name="suffix")
</template>

<script>
export default {
  emits: ['update:modelValue'],
  inheritAttrs: false,

  props: {
    modelValue: { type: [String, Number], default: null },
    type: { type: String, default: 'text' },
    id: { type: String, default: null },
    name: { type: String, default: null },
    title: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    autofocus: { type: Boolean, default: false },
    focused: { type: Boolean, default: false },
    placeholder: { type: String, default: null },
    autocomplete: { type: String, default: 'off' }
  },

  data() {
    return {
      currentValue: this.modelValue
    }
  },

  computed: {
    classes() {
      return [
        this.$attrs.class,
        {
          'dito-input--focus': this.focused
        }
      ]
    },

    attributes() {
      const { class: _, ...attributes } = this.$attrs
      return attributes
    },

    input() {
      return this.$refs.input
    },

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
      this.input.focus()
    },

    blur() {
      this.input.blur()
    },

    onMouseDown() {
      // Focus the input when the outer container is clicked, e.g. when clicking
      // on affixes.
      if (!this.disabled && !this.readonly) {
        this.focus()
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-input {
  display: inline-flex;
  align-items: center;

  @extend %input;

  input {
    // Inherit all styling from .dito-input
    all: inherit;
    flex: 1;
    min-width: 0;
    display: inline-block;
    border: 0;
    margin: 0;
    padding: 0;
  }
}
</style>
