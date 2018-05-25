<template lang="pug">
  .dito-schema-header
    .dito-label(v-if="label") {{ label }}
    .dito-tabs
      a(
        v-for="(tabSchema, key) in tabs"
        :href="`#${key}`"
        :class="{ selected: selectedTab === key }"
      )
        | {{ getLabel(tabSchema, key) }}
    .dito-clipboard.dito-buttons.dito-buttons-round(
      v-if="clipboard"
    )
      button.dito-button.dito-button-copy(
        type="button"
        ref="copyData"
        title="Copy Data"
      )
      button.dito-button.dito-button-paste(
        type="button"
        @click="pasteData"
        title="Paste Data"
        :disabled="!appState.clipboardData"
      )
</template>

<style lang="sass">
$tab-color-background: $color-white
$tab-color-inactive: $button-color
$tab-color-hover: lighten($tab-color-inactive, 5%)
$tab-color-active: $tab-color-inactive
$tab-height: $menu-font-size + 2 * $tab-padding-ver

.dito
  .dito-schema-header
    display: flex
    box-sizing: border-box
    // turn off pointer events in background so that DitoTrail keeps working.
    pointer-events: none
    justify-content: space-between
    > *
      pointer-events: auto
    .dito-tabs,
    .dito-buttons
      display: flex
      align-self: flex-end
    .dito-tabs
      // See: https://codepen.io/tholex/pen/hveBx/
      margin-left: auto
      a
        display: block
        +user-select(none)
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
    .dito-buttons
      .dito-button
        margin: 0 0 $tab-margin $tab-margin
  // Style tabs on the main level
  .dito-parent > .dito-scroll > .dito-schema-header
    position: absolute
    height: $tab-height
    margin-top: -$tab-height
    padding: 0 $menu-padding-hor
    max-width: $content-width
    top: 0
    left: 0
    right: 0
    z-index: $menu-z-index
    > *
      font-size: $menu-font-size
    .dito-tabs a
      line-height: $menu-line-height
      padding: $tab-padding-ver $tab-padding-hor
</style>

<script>
import DitoComponent from '@/DitoComponent'
import Clipboard from 'clipboard'
import { clone } from '@ditojs/utils'

export default DitoComponent.component('dito-schema-header', {
  props: {
    label: { type: String, required: false },
    tabs: { type: Object, required: false },
    selectedTab: { type: String, required: false },
    clipboard: { type: Boolean, default: false }
  },

  data() {
    return {
      $clipboard: null
    }
  },

  mounted() {
    if (this.clipboard) {
      this.$clipboard = new Clipboard(this.$refs.copyData, {
        text: () => {
          if (this.formComponent) {
            const data = this.formComponent.clipboardData
            this.appState.clipboardData = clone(data)
            return JSON.stringify(data)
          }
        },
        action: 'copy'
      })
    }
  },

  destroyed() {
    this.$clipboard?.destroy()
  },

  methods: {
    pasteData() {
      const { clipboardData } = this.appState
      const targetData = this.formComponent?.data
      if (clipboardData && targetData) {
        for (const key in clipboardData) {
          this.$set(targetData, key, clipboardData[key])
        }
      }
    }
  }
})
</script>
