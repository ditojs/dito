<template lang="pug">
DitoTrigger.dito-color(
  v-model:show="showPopup"
  trigger="focus"
)
  template(#trigger)
    DitoInput(
      :id="componentPath"
      ref="element"
      v-model="hexValue"
      type="input"
      size="8"
      :focused="showPopup"
      v-bind="attributes"
    )
      template(#prefix)
        DitoInputAffixes(
          position="prefix"
          v-bind="inputAffixesProps.prefix"
        )
      template(#suffix)
        DitoInputAffixes(
          position="suffix"
          v-bind="inputAffixesProps.suffix"
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
import { computed, ref, watch } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import { createChangeOnceEdited } from '../utils/changeOnceEdited.js'

// @vue/component
const DitoTypeColor = {
  name: 'DitoTypeColor',
  components: { DitoTrigger, DitoInput, DitoInputAffixes, SketchPicker },
  props: fieldProps,

  setup(props) {
    const field = useField(props, {
      // The input's native change events don't tell when the editing is done,
      // as the picker edits the value too, see `changeOnceEdited`. They are
      // handled to keep them from emitting the schema's change events.
      getEvents: ({ onFocus, onInput }) => ({
        onFocus,
        onBlur,
        onInput,
        onChange: () => {}
      })
    })
    const { value, focused, readonly, getSchemaValue } = field
    const showPopup = ref(false)
    // The value of the input while it can't be written, see `hexValue`:
    const convertedValue = ref(null)

    // Emits the change of the value once the editing is done, i.e. once
    // neither the input is focused nor the picker is open.
    const changeOnceEdited = createChangeOnceEdited({
      isEditing: () => focused.value || showPopup.value,
      emitChange: () => field.onChange()
    })

    // TODO: `format` clashes with `schema.format()`, which shall be renamed
    // soon to `formatValue()`. Rename `colorFormat` back to `format` after.
    const colorFormat = computed(() =>
      getSchemaValue('format', { type: String, default: 'hex' })
    )

    const canUpdateValue = computed(() => !focused.value || readonly.value)

    // Sets a value that the user edited, through the input or the picker.
    // Values changed by code don't emit change events.
    const setEditedValue = editedValue => {
      value.value = editedValue
      changeOnceEdited.markEdited()
      changeOnceEdited.emitIfDone()
    }

    function onBlur() {
      field.onBlur()
      changeOnceEdited.emitIfDone()
    }

    watch(canUpdateValue, canUpdateValue => {
      if (canUpdateValue && convertedValue.value !== null) {
        setEditedValue(convertedValue.value)
        convertedValue.value = null
      }
    })

    watch(showPopup, showPopup => {
      if (!showPopup) {
        changeOnceEdited.emitIfDone()
      }
    })

    return {
      value,
      showPopup,
      attributes: field.attributes,
      context: field.context,
      componentPath: field.componentPath,
      inputAffixesProps: field.inputAffixesProps,

      colorValue: computed({
        get() {
          return tinycolor(convertedValue.value || value.value || '#000000')
        },

        set(color) {
          // Picker changes take precedence over values typed into the input.
          convertedValue.value = null
          // Skip unchanged colors, as converting formats like `hsl` back and
          // forth isn't lossless and would cause endless updates.
          if (
            !value.value ||
            color.toHex8String() !== tinycolor(value.value).toHex8String()
          ) {
            setEditedValue(toTinyColorFormat(color, colorFormat.value))
            // The input emits its own input events, the picker doesn't:
            field.onInput()
          }
        }
      }),

      hexValue: computed({
        get() {
          const color = tinycolor(value.value)
          return color.isValid()
            ? color
                .toString(color.getAlpha() < 1 ? 'hex8' : 'hex6')
                .slice(1)
                .toLowerCase()
            : null
        },

        set(hex) {
          const color = tinycolor(hex)
          if (color.isValid()) {
            const converted = convertColor(hex, colorFormat.value)
            if (canUpdateValue.value) {
              setEditedValue(converted)
            } else {
              // Store to change later, once `canUpdateValue` is true again.
              convertedValue.value = converted
            }
          }
        }
      }),

      // TODO: Rename to `showAlpha`?
      alpha: computed(() =>
        getSchemaValue('alpha', { type: Boolean, default: false })
      ),

      // TODO: Rename to `showInputs`?
      inputs: computed(() =>
        getSchemaValue('inputs', { type: Boolean, default: true })
      ),

      presets: computed(() =>
        getSchemaValue('presets', { type: Array, default: defaultPresets })
      ),

      clear() {
        // Clearing replaces the edits that are pending, see `hexValue` and
        // `changeOnceEdited`, and emits its own change event.
        convertedValue.value = null
        changeOnceEdited.reset()
        field.clear()
      }
    }
  }
}

defineType({
  types: ['color'],
  component: DitoTypeColor
})

export default DitoTypeColor

const defaultPresets = [
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
