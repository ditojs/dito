<template lang="pug">
  .dito-tabs(v-if="tabs")
    template(v-for="(tabSchema, key) in tabs")
      a(
        :href="`#${key}`"
        :class="{ selected: selectedTab === key }"
      )
        | {{ tabSchema.label }}
</template>

<style lang="sass">
$tab-color-background: $color-white
$tab-color-inactive: $button-color
$tab-color-hover: lighten($tab-color-inactive, 5%)
$tab-color-active: $tab-color-inactive

.dito
  .dito-tabs
    position: absolute
    width: 100%
    max-width: $content-width
    box-sizing: border-box
    padding: 0 $menu-padding-hor
    z-index: $menu-z-index
    margin-top: -$menu-font-size - 2 * $tab-padding-ver
    display: flex
    justify-content: flex-end
    pointer-events: none
    > *
      pointer-events: auto
    a
      line-height: $menu-line-height
      font-size: $menu-font-size
      padding: $tab-padding-ver $tab-padding-hor
      background: $tab-color-inactive
      margin-left: $tab-margin
      border-top-left-radius: $tab-radius
      border-top-right-radius: $tab-radius
      &:hover
        background: $tab-color-hover
      &:active
        background: $tab-color-active
      &.selected
        background: $tab-color-background
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-tabs', {
  props: {
    tabs: { type: Object, required: false },
    selectedTab: { type: String, required: false }
  }
})
</script>
