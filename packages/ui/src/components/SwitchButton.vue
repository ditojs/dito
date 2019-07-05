<template lang="pug">
  label.dito-switch(
    :class="classes"
    :style="styles"
  )
    input(
      type="checkbox"
      ref="input"
      :name="name"
      :disabled="disabled"
      v-model="checked"
    )
    .dito-switch-pane
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
    vertical-align: bottom
    display: inline-block
    position: relative
    // For the baseline to be aligned well:
    vertical-align: bottom
    height: calc(var(--switch-height) - 1px)
    +user-select(none)
    cursor: pointer
    input
      opacity: 0
      position: absolute
      width: 1px
      height: 1px
    .dito-switch-label
      position: absolute
      right: var(--label-margin)
      top: 50%
      transform: translateY(-50%)
      text-transform: uppercase
      color: $color-white
    .dito-switch-pane
      --width: calc(var(--switch-width) - 2 * var(--switch-margin))
      --height: calc(var(--switch-height) - 2 * var(--switch-margin))
      --offset: calc(var(--width) - var(--height))
      display: block
      position: absolute
      position: relative
      box-sizing: border-box
      width: var(--width)
      height: var(--height)
      top: 50%
      transform: translateY(-50%)
      border: var(--switch-padding) solid transparent
      border-radius: 1em
      background: $color-light
      transition: border-color .3s, background-color .3s
      .dito-switch-button
        display: block
        position: absolute
        // Set font-size to height, so we can use width/height = 1em for circle:
        font-size: calc(var(--height) - 2 * var(--switch-padding))
        top: 0
        left: 0
        width: 1em
        height: 1em
        border-radius: 0.5em
        background: $color-white
        transition: transform var(--switch-speed)
        transform: translateX(0)
    &.dito-checked
      .dito-switch-pane
        background-color: $color-active
      .dito-switch-button
        transform: translateX(var(--offset))
      .dito-switch-label
        left: var(--label-margin)
        right: unset
    &.dito-disabled
      pointer-events: none
      opacity: 0.6
</style>

<script>
export default {
  props: {
    value: { type: Boolean, default: false },
    name: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    sync: { type: Boolean, default: false },
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
      // Calculate `--switch-width` in rem based on label length
      const length = Math.max(0, checked?.length, unchecked?.length)
      return {
        '--switch-width': length ? `${length * 1.5}rem` : null
      }
    }
  },

  watch: {
    value(value) {
      this.checked = value
    },

    checked(checked) {
      this.$emit('input', checked)
      this.$emit('change', checked)
    }
  },

  methods: {
    focus() {
      this.$refs.input.focus()
    }
  }
}
</script>
