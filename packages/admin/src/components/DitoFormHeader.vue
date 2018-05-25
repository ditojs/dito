<template lang="pug">
  .dito-form-header
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
  .dito-form-header
    position: absolute
    max-width: $content-width
    top: 0
    left: 0
    right: 0
    height: $tab-height
    margin-top: -$tab-height
    box-sizing: border-box
    padding: 0 $menu-padding-hor
    z-index: $menu-z-index
    display: flex
    justify-content: flex-end
    // turn off pointer events in background so that DitoTrail keeps working.
    pointer-events: none
    > *
      pointer-events: auto
      font-size: $menu-font-size
    a
      +user-select(none)
      line-height: $menu-line-height
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
    .dito-buttons
      display: flex
      align-items: flex-end
      .dito-button
        margin: 0 0 $tab-margin $tab-margin
</style>

<script>
import DitoComponent from '@/DitoComponent'
import Clipboard from 'clipboard'
import { clone } from '@ditojs/utils'

export default DitoComponent.component('dito-form-header', {
  props: {
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
