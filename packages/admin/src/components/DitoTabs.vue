<template lang="pug">
  .dito-tabs(v-if="tabs")
    template(v-for="(tab, key) in tabs")
      input(type="radio", :id="key", :name="`${name}-tabs`", :checked="key === selectedTab")
      label(:for="key") {{ tab.label }}
      dito-panel(:desc="tab", :data="data", :user="user", :disabled="disabled")
</template>

<style lang="sass">
  // CSS-only tabs, based on: https://kyusuf.com/post/completely-css-tabs
  $tab-border: $tab-border-width solid $tab-border-color

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
      padding: 0.5em 0.5em 0
      background: $tab-color-background
      border: $tab-border
      border-radius: $tab-radius
      box-shadow: 0 1px 1px 0 rgba(33,33,33,0.1)
      z-index: 1
      // Visually move panels below all tabs
      order: 100
      width: 320px

      &:first-of-type
        border-top-left-radius: 0

    > label
      padding: $tab-padding-ver $tab-padding-hor ($tab-padding-ver + $tab-radius)
      background: $tab-color-inactive
      border: $tab-border
      // Overlap right and bottom borders
      margin: 0 (-$tab-border-width) (-$tab-radius) 0
      cursor: pointer
      user-select: none
      border-top-left-radius: $tab-radius
      border-top-right-radius: $tab-radius
      &:hover
        background: $tab-color-hover
      &:active
        background: $tab-color-active

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
        border-bottom: none
        padding-bottom: $tab-padding-ver
        margin-bottom: -$tab-border-width
        & + .dito-panel
          display: block
</style>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-tabs', {
  props: {
    name: { type: String, required: true },
    tabs: { type: Object, required: false },
    data: { type: Object, required: true },
    user: { type: Object, required: true },
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
