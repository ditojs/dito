<template lang="pug">
  trigger.dito-color(
    trigger="click"
    :show.sync="showPopup"
  )
    .dito-input(
      slot="trigger"
      :class="{ 'dito-focus': showPopup }"
    )
      input(
        ref="element"
        :id="dataPath"
        type="input"
        size="8"
        v-model="hexValue"
        v-bind="attributes"
        v-on="listeners"
      )
      .dito-color-preview.dito-inherit-focus(
        v-if="value"
      )
        div(:style="{ background: `#${hexValue || '00000000'}` }")
      button.dito-button-clear.dito-button-overlay(
        v-if="showClearButton"
        @click.stop="clear"
        :disabled="disabled"
      )
    sketch-picker.dito-color-picker(
      slot="popup"
      v-model="colorValue"
      :disable-alpha="!alpha"
      :disable-fields="!inputs"
      :preset-colors="presets"
    )
</template>

<style lang="sass">
  $color-swatch-width: $pattern-transparency-size
  $color-swatch-radius: $border-radius - $border-width
  .dito-color
    .dito-input
      display: block
      position: relative
      input
        box-sizing: border-box
        font-variant-numeric: tabular-nums
        padding-right: $color-swatch-width
    .dito-button-clear
      margin-right: $color-swatch-width
    .dito-color-picker
      margin: $popup-margin
      border: $border-style
      border-radius: $border-radius
      background: $color-white
      box-shadow: $shadow-window
    .dito-color-preview
      background: $pattern-transparency
      border-left: $border-style
      &,
      div
        position: absolute
        width: $color-swatch-width
        top: 0
        right: 0
        bottom: 0
        border-top-right-radius: $color-swatch-radius
        border-bottom-right-radius: $color-swatch-radius
</style>

<script>
import tinycolor from 'tinycolor2'
import { Sketch as SketchPicker } from 'vue-color'
import TypeComponent from '../TypeComponent.js'
import { Trigger } from '@ditojs/ui'
import { getSchemaAccessor } from '../utils/accessor.js'

// @vue/component
export default TypeComponent.register('color', {
  components: { Trigger, SketchPicker },

  data() {
    return {
      showPopup: false,
      convertedHexValue: null
    }
  },

  computed: {
    colorValue: {
      get() {
        return this.value || {}
      },

      set(value) {
        const format = this.colorFormat
        const key = {
          // NOTE: vue-color calls it 'hex', while tinycolor calls it 'hex6'
          hex: value?.a < 1 ? 'hex8' : 'hex',
          rgb: 'rgba'
        }[format] || format
        if (key) {
          this.value = value[key]
        } else {
          this.value = tinycolor(value).toString(format)
        }
        this.onChange()
      }
    },

    hexValue: {
      get() {
        if (this.value == null) {
          this.convertedHexValue = null
        } else if (!this.focused) {
          const color = tinycolor(this.value)
          if (color.isValid()) {
            this.convertedHexValue = color
              .toString(color.getAlpha() < 1 ? 'hex8' : 'hex6')
              .slice(1)
              .toUpperCase()
          }
        }
        return this.convertedHexValue
      },

      set(value) {
        this.convertedHexValue = value
      }
    },

    // TODO: `format` clashes with TypeMixin.format()`, which shall be renamed
    // soon to `formatValue()`. Rename `colorFormat` back to `format` after.
    colorFormat: getSchemaAccessor('format', {
      type: String,
      default: 'hex'
    }),

    alpha: getSchemaAccessor('alpha', {
      type: Boolean,
      default: false
    }),

    inputs: getSchemaAccessor('inputs', {
      type: Boolean,
      default: true
    }),

    presets: getSchemaAccessor('presets', {
      type: Array,
      default: [
        '#ffffff',
        '#c3c3c3',
        '#7f7f7f',
        '#000000',
        '#880015',
        '#ed1c24',
        '#ff7f27',
        '#fff200',

        '#22b14c',
        '#00a2e8',
        '#3f48cc',
        '#a349a4',
        '#b97a57',
        '#ffaec9',
        '#ffc90e',
        '#00000000'
      ]
    })
  },

  watch: {
    focused(focused) {
      if (!focused && this.convertedHexValue) {
        const color = tinycolor(`#${this.convertedHexValue}`)
        if (color?.isValid()) {
          this.value = color.toString(this.colorFormat)
          // TODO: Emit 'input' here instead, and 'change' in blur, like others.
          this.onChange()
        }
      }
    }
  }
})

</script>
