<template lang="pug">
DitoTrigger.dito-color(
  v-model:show="showPopup"
  trigger="focus"
)
  template(#trigger)
    DitoInput(
      :id="dataPath"
      ref="element"
      v-model="hexValue"
      type="input"
      size="8"
      :focused="showPopup"
      v-bind="attributes"
    )
      template(#prefix)
        DitoAffixes(
          :items="schema.prefix"
          position="prefix"
          mode="input"
          :disabled="disabled"
          :parentContext="context"
        )
      template(#suffix)
        DitoAffixes(
          :items="schema.suffix"
          position="suffix"
          mode="input"
          :clearable="showClearButton"
          :disabled="disabled"
          :inlineInfo="inlineInfo"
          :parentContext="context"
          @clear="clear"
        )
          template(#append)
            .dito-color__preview(
              v-if="value"
            )
              div(:style="{ background: `#${hexValue || '00000000'}` }")
  template(#popup)
    SketchPicker.dito-color__picker(
      v-model:tinyColor="colorValue"
      :disableAlpha="!alpha"
      :disableFields="!inputs"
      :presetColors="presets"
    )
</template>

<script>
// Use the `tinycolor` exported by `vue-color`, as required for its
// `v-model:tinyColor` binding.
import { SketchPicker, tinycolor } from 'vue-color'
import { DitoTrigger, DitoInput } from '@ditojs/ui/src'
import DitoTypeComponent from '../DitoTypeComponent.js'
import DitoAffixes from '../components/DitoAffixes.vue'
import { getSchemaAccessor } from '../utils/accessor.js'

// @vue/component
export default DitoTypeComponent.register('color', {
  components: { DitoTrigger, DitoInput, DitoAffixes, SketchPicker },

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
        return tinycolor(this.convertedValue || this.value || '#000000')
      },

      set(color) {
        // Picker changes take precedence over values typed into the input.
        this.convertedValue = null
        // Skip unchanged colors, as converting formats like `hsl` back and
        // forth isn't lossless and would cause endless updates.
        const { value } = this
        if (
          !value ||
          color.toHex8String() !== tinycolor(value).toHex8String()
        ) {
          this.value = toTinyColorFormat(color, this.colorFormat)
        }
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
  return toTinyColorFormat(tinycolor(color), format)
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
      // Preserve alpha channel if present
      return color.getAlpha() < 1
        ? `#${color.toHex8()}`
        : `#${color.toHex()}`
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';
@import 'vue-color/style.css';

$color-swatch-width: $pattern-transparency-size;
$color-swatch-radius: $border-radius - $border-width;

.dito-color {
  .dito-input {
    display: flex;
    position: relative;

    input {
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
      padding-right: $color-swatch-width;
    }
  }

  &__picker {
    margin: $popup-margin;
    border: $border-style;
    border-radius: $border-radius;
    background: $color-white;
    box-shadow: $shadow-window;
  }

  &__preview {
    background: $pattern-transparency;
    margin: (-$input-padding-ver) (-$input-padding-hor);
    margin-left: 0;
    border-left: $border-style;

    &,
    div {
      width: $color-swatch-width;
      height: calc($input-height - 2 * $border-width);
      border-top-right-radius: $color-swatch-radius;
      border-bottom-right-radius: $color-swatch-radius;
    }
  }

  // Inherit input focus state
  .dito-input:focus-within &__preview,
  .dito-input--focus &__preview {
    border-left-color: $color-active;
  }
}
</style>
