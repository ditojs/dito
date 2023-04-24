<template lang="pug">
.dito-switch(
  :class="classes"
  :style="styles"
)
  .dito-switch-pane
    input(
      :id="id"
      ref="input"
      v-bind="$attrs"
      v-model="checked"
      type="checkbox"
      :name="name"
      :disabled="disabled"
    )
    .dito-switch-button
    span.dito-switch-label(
      v-if="labels"
    )
      slot(
        v-if="checked"
        name="checked"
      ) {{ labels.checked || 'on' }}
      slot(
        v-else
        name="unchecked"
      ) {{ labels.unchecked || 'off' }}
</template>

<script>
export default {
  emits: ['update:modelValue', 'change'],

  props: {
    modelValue: { type: Boolean, default: false },
    id: { type: String, default: null },
    name: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    labels: { type: [Object, Boolean], default: false }
  },

  data() {
    return {
      checked: this.modelValue
    }
  },

  computed: {
    classes() {
      const { checked, disabled } = this
      return {
        'dito-checked': checked,
        'dito-disabled': disabled
      }
    },

    styles() {
      const { labels: { checked, unchecked } = {} } = this
      // Calculate `--switch-width` in `rem`, based on label length.
      const length = Math.max(0, checked?.length, unchecked?.length)
      return {
        '--switch-width': length ? `${length * 1.5}rem` : null
      }
    }
  },

  watch: {
    modelValue(modelValue) {
      this.checked = modelValue
    },

    checked(checked) {
      if (checked !== this.modelValue) {
        this.$emit('update:modelValue', checked)
        this.$emit('change', checked)
      }
    }
  },

  methods: {
    focus() {
      this.$refs.input.focus()
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-switch {
  // Use whole multiples of `rem` for sizes and `px` margins/padding along
  // with `calc()` to end up with even pixel sizes.
  --switch-width: 4em;
  --switch-height: 2em;
  --switch-margin: 2px;
  --switch-padding: 3px;
  --switch-speed: 300ms;
  --label-margin: 0.5em;
  --width: calc(var(--switch-width) - 2 * var(--switch-margin));
  --height: calc(var(--switch-height) - 2 * var(--switch-margin));
  --offset: calc(var(--width) - var(--height));

  display: inline-block;
  position: relative;
  height: var(--switch-height);
  // To make inline labels appear on consistent baseline:
  vertical-align: bottom;
  @include user-select(none);

  .dito-switch-pane {
    position: relative;
    width: var(--width);
    height: var(--height);
  }

  .dito-switch-pane,
  .dito-switch-label {
    top: 50%;
    transform: translateY(-50%);
  }

  input {
    cursor: pointer;
    appearance: none;
    width: 100%;
    height: 100%;
    border-radius: 1em;
    background: $color-light;
    transition: border-color 0.3s, background-color 0.3s;
  }

  .dito-switch-button {
    --size: calc(var(--height) - 2 * var(--switch-padding));

    position: absolute;
    top: var(--switch-padding);
    left: var(--switch-padding);
    width: var(--size);
    height: var(--size);
    border-radius: calc(var(--size) / 2);
    box-sizing: border-box;
    background: $color-white;
    transition: transform var(--switch-speed);
    transform: translateX(0);
  }

  .dito-switch-button,
  .dito-switch-label {
    pointer-events: none;
  }

  .dito-switch-label {
    position: absolute;
    right: var(--label-margin);
    text-transform: uppercase;
    color: $color-white;
  }

  &.dito-checked {
    input {
      background: $color-active;
    }

    .dito-switch-button {
      transform: translateX(var(--offset));
    }

    .dito-switch-label {
      left: var(--label-margin);
      right: unset;
    }
  }

  &.dito-disabled {
    @extend %button-disabled;
  }

  &:focus-within:not(:hover) {
    .dito-switch-button {
      box-shadow: $shadow-focus;
    }
  }
}
</style>
