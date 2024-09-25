<template lang="pug">
Trigger.dito-color(
  v-model:show="showPopup"
  trigger="focus"
)
  template(#trigger)
    .dito-input(:class="{ 'dito-focus': showPopup }")
      input(
        :id="dataPath"
        ref="element"
        v-model="hexValue"
        type="input"
        size="8"
        v-bind="attributes"
      )
      .dito-color-preview.dito-inherit-focus(
        v-if="value"
      )
        div(:style="{ background: `#${hexValue || '00000000'}` }")
      button.dito-button-clear.dito-button-overlay(
        v-if="showClearButton"
        :disabled="disabled"
        @click.stop="clear"
      )
  template(#popup)
    SketchPicker.dito-color-picker(
      v-model="colorValue"
      :disableAlpha="!alpha"
      :disableFields="!inputs"
      :presetColors="presets"
    )
</template>

<script>
import tinycolor from 'tinycolor2'
import { Sketch as SketchPicker } from '@lk77/vue3-color'
import { isObject, isString } from '@ditojs/utils'
import { Trigger } from '@ditojs/ui/src'
import DitoTypeComponent from '../DitoTypeComponent.js'
import { getSchemaAccessor } from '../utils/accessor.js'

// Monkey-patch the `SketchPicker's` `hex` computed property to return lowercase
// hex values instead of uppercase ones.
const { hex } = SketchPicker.computed
SketchPicker.computed.hex = function () {
  return hex.call(this).toLowerCase()
}

// @vue/component
export default DitoTypeComponent.register('color', {
  components: { Trigger, SketchPicker },

  data() {
    return {
      showPopup: false,
      convertedValue: null
    }
  },

  computed: {
    canUpdateValue() {
      return !this.focused || this.readonly
    },

    colorValue: {
      get() {
        return (
          this.convertedValue ||
          this.value ||
          (this.colorFormat === 'hex' ? '' : {})
        )
      },

      set(value) {
        this.value = convertColor(value, this.colorFormat)
      }
    },

    hexValue: {
      get() {
        const color = tinycolor(this.value)
        return color.isValid()
          ? color
              .toString(color.getAlpha() < 1 ? 'hex8' : 'hex6')
              .slice(1)
              .toLowerCase()
          : null
      },

      set(value) {
        const color = tinycolor(value)
        if (color.isValid()) {
          const convertedValue = convertColor(value, this.colorFormat)
          if (this.canUpdateValue) {
            this.value = convertedValue
          } else {
            // Store to change later, once `canUpdateValue` is true again.
            // See `watch` below.
            this.convertedValue = convertedValue
          }
        }
      }
    },

    // TODO: `format` clashes with TypeMixin.format()`, which shall be renamed
    // soon to `formatValue()`. Rename `colorFormat` back to `format` after.
    colorFormat: getSchemaAccessor('format', {
      type: String,
      default: 'hex'
    }),

    // TODO: Rename to `showAlpha`?
    alpha: getSchemaAccessor('alpha', {
      type: Boolean,
      default: false
    }),

    // TODO: Rename to `showInputs`?
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
    value: 'onChange',

    canUpdateValue(canUpdateValue) {
      if (canUpdateValue && this.convertedValue !== null) {
        this.value = this.convertedValue
        this.convertedValue = null
      }
    }
  }
})

function convertColor(color, format) {
  return isObject(color) // a vue3-color color object
    ? toVue3ColorFormat(color, format)
    : toTinyColorFormat(tinycolor(color), format)
}

function toVue3ColorFormat(color, format) {
  const value =
    color[
      {
        hex: color?.a < 1 ? 'hex8' : 'hex',
        rgb: 'rgba'
      }[format] ||
      format
    ]
  return isString(value) && value[0] === '#' ? value.toLowerCase() : value
}

// This should really be in tinycolor, but it only has the string equivalent
// of it.
function toTinyColorFormat(color, format) {
  switch (format) {
    case 'rgb':
      return color.toRgb()
    case 'prgb':
      return color.toPercentageRgb()
    case 'name':
      return color.toName()
    case 'hsl':
      return color.toHsl()
    case 'hsv':
      return color.toHsv()
    case 'hex3':
      return `#${color.toHex(true)}`
    case 'hex4':
      return `#${color.toHex8(true)}`
    case 'hex8':
      return `#${color.toHex8()}`
    case 'hex':
    case 'hex6':
    default:
      return `#${color.toHex()}`
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

$color-swatch-width: $pattern-transparency-size;
$color-swatch-radius: $border-radius - $border-width;

.dito-color {
  .dito-input {
    display: block;
    position: relative;

    input {
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
      padding-right: $color-swatch-width;
    }
  }

  .dito-button-clear {
    margin-right: $color-swatch-width;
  }

  .dito-color-picker {
    margin: $popup-margin;
    border: $border-style;
    border-radius: $border-radius;
    background: $color-white;
    box-shadow: $shadow-window;
  }

  .dito-color-preview {
    background: $pattern-transparency;
    border-left: $border-style;

    &,
    div {
      position: absolute;
      width: $color-swatch-width;
      top: 0;
      right: 0;
      bottom: 0;
      border-top-right-radius: $color-swatch-radius;
      border-bottom-right-radius: $color-swatch-radius;
    }
  }
}
</style>
