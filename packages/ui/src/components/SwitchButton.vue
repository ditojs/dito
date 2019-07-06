<template lang="pug">
  .dito-switch(
    :class="classes"
    :style="styles"
  )
    .dito-switch-pane
      input(
        type="checkbox"
        ref="input"
        v-model="checked"
        v-bind="attributes"
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

<style lang="sass">
  .dito-switch
    // Use whole multiples of `rem` for sizes and `px` margins/padding along
    // with `calc()` to end up with even pixel sizes. `rem` is needed because we
    // change `font-size` inside `.dito-switch-button`
    --switch-width: 4rem
    --switch-height: 2rem
    --switch-margin: 2px
    --switch-padding: 3px
    --switch-speed: 300ms
    --label-margin: 0.5em

    --width: calc(var(--switch-width) - 2 * var(--switch-margin))
    --height: calc(var(--switch-height) - 2 * var(--switch-margin))
    --offset: calc(var(--width) - var(--height))

    display: inline-block
    position: relative
    // For the baseline to aligned well with compact labels, use `bottom`
    // alignment and remove 1px from height (why does this work?)
    vertical-align: bottom
    height: calc(var(--switch-height) - 1px)
    +user-select(none)
    .dito-switch-pane
      position: relative
      width: var(--width)
      height: var(--height)
    .dito-switch-pane,
    .dito-switch-label
      top: 50%
      transform: translateY(-50%)
    input
      cursor: pointer
      appearance: none
      width: 100%
      height: 100%
      border-radius: 1em
      background: $color-light
      transition: border-color .3s, background-color .3s
      &:focus
        outline: none
    .dito-switch-button
      position: absolute
      // Set font-size to height, so we can use width/height = 1em for circle:
      font-size: calc(var(--height) - 2 * var(--switch-padding))
      top: var(--switch-padding)
      left: var(--switch-padding)
      width: 1em
      height: 1em
      border-radius: 0.5em
      border: 1px solid transparent
      box-sizing: border-box
      background: $color-white
      transition: transform var(--switch-speed)
      transform: translateX(0)
    .dito-switch-button,
    .dito-switch-label
      pointer-events: none
    .dito-switch-label
      position: absolute
      right: var(--label-margin)
      text-transform: uppercase
      color: $color-white
    &.dito-checked
      input
        background: $color-active
      .dito-switch-button
        transform: translateX(var(--offset))
      .dito-switch-label
        left: var(--label-margin)
        right: unset
    &.dito-disabled
      @extend %button-disabled
    &:focus-within:not(:hover)
      .dito-switch-button
        border: 1px solid $color-active
</style>

<script>
export default {
  props: {
    value: { type: Boolean, default: false },
    id: { type: String, default: null },
    name: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    labels: { type: [Object, Boolean], default: false }
  },

  data() {
    return {
      checked: this.value
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
    },

    attributes() {
      const { id, name, disabled, $attrs } = this
      return { id, name, disabled, ...$attrs }
    }
  },

  watch: {
    value(value) {
      this.checked = value
    },

    checked(checked) {
      if (checked !== this.value) {
        this.$emit('input', checked)
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
