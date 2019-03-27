<template lang="pug">
  .dito-tabs
    router-link(
      v-for="(tabSchema, key) in tabs"
      :key="key"
      :to="{ hash: key }"
      :class="{ selected: selectedTab === key }"
    )
      | {{ getLabel(tabSchema, key) }}
</template>

<style lang="sass">
$tab-color-background: $color-white
$tab-color-inactive: $button-color
$tab-color-hover: lighten($tab-color-inactive, 5%)
$tab-color-active: $tab-color-inactive

.dito
  .dito-tabs
    // See: https://codepen.io/tholex/pen/hveBx/
    margin-left: auto
    a
      display: block
      +user-select(none)
      background: $tab-color-inactive
      padding: $tab-padding-ver $tab-padding-hor
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

// @vue/component
export default DitoComponent.component('dito-tabs', {
  props: {
    tabs: { type: Object, default: null },
    selectedTab: { type: String, default: null }
  }
})
</script>
