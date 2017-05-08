<template lang="pug">
  .dito-tabs(v-if="tabs")
    template(v-for="(tab, key) in tabs")
      input(
        type="radio",
        :id="key",
        :name="`${name}-tabs`",
        :checked="key === selectedTab"
      )
      label(:for="key") {{ tab.label }}
      dito-panel(
        :desc="tab",
        :data="data",
        :meta="meta",
        :disabled="disabled"
      )
</template>

<style lang="sass">
$tab-color-background: $color-white
$tab-color-inactive: $color-button
$tab-color-hover: lighten($tab-color-inactive, 5%)
$tab-color-active: $tab-color-inactive

.dito
  // CSS-only tabs, based on: https://kyusuf.com/post/completely-css-tabs
  .dito-tabs
    display: flex
    flex-wrap: wrap
    padding: 0 0 0.5em
    &::after
      // Force width to make small .dito-panel elements appear below tabs
      content: ''
      width: 100%

    > .dito-panel
      display: none
      padding: 0.5em 1em
      background: $tab-color-background
      border: $border-style
      border-radius: $border-radius
      box-shadow: $shadow-settings rgba($color-shadow, 0.2)
      z-index: 1
      // Visually move panels below all tabs
      order: 100
      width: 320px

      &:first-of-type
        border-top-left-radius: 0

    > label
      padding: $tab-padding-ver $tab-padding-hor ($tab-padding-ver + $border-radius)
      background: $tab-color-inactive
      border: $border-width solid $tab-color-inactive
      // Overlap right and bottom borders
      margin: 0 (-$border-width) (-$border-radius) 0
      cursor: pointer
      user-select: none
      border-top-left-radius: $border-radius
      border-top-right-radius: $border-radius
      &:hover
        background: $tab-color-hover
        border-color: $border-color
      &:active
        background: $tab-color-active
        border-color: $border-color

    > input
      width: 0
      border: 0
      margin: 0
      opacity: 0
      @-moz-document url-prefix()
        // On Firefox, we can't use `display: absolute` along with `opacity> 0` to
        // hide the input, as that would break flex layout. And setting width and
        // border to 0 still produces a 2px border, so we have to offset by 2px
        margin: 0 -2px
      &:checked + label
        z-index: 2
        background: $tab-color-background
        border-color: $border-color
        border-bottom: none
        padding-bottom: $tab-padding-ver
        margin-bottom: -$border-width
        & + .dito-panel
          display: block
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-tabs', {
  props: {
    name: { type: String, required: true },
    tabs: { type: Object, required: false },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    disabled: { type: Boolean, required: true }
  },
  computed: {
    selectedTab() {
      // Return the first key from the tabs object
      return this.tabs && Object.keys(this.tabs)[0]
    }
  }
})
</script>
