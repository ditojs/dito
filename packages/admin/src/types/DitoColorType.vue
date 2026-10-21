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
// `v-model:tinyColor` requires the `tinycolor` exported by `vue-color`:
import { SketchPicker, tinycolor } from 'vue-color'
import { DitoTrigger, DitoInput } from '@ditojs/ui/src'
import { computed, ref, watch } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { assertRemovedSchemaKeys } from '../utils/schema/setup.js'
import { colorTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import { createChangeOnceEdited } from '../utils/changeOnceEdited.js'

// @vue/component
const DitoColorType = {
  components: { DitoTrigger, DitoInput, DitoInputAffixes, SketchPicker },
  props: fieldProps,

  setup(props) {
    const field = useField(props, {
      // Native change events don't tell when editing is done, as the picker
      // edits the value too. Swallow them, see `changeOnceEdited`:
      getEvents: ({ onFocus }) => ({
        onFocus,
        onBlur,
        onChange: () => {}
      })
    })
    const { value, focused, readonly, getSchemaValue } = field
    const showPopup = ref(false)
    // The value of the input while it can't be written, see `hexValue`:
    const enteredValue = ref(null)

    const changeOnceEdited = createChangeOnceEdited({
      isEditing: () => focused.value || showPopup.value,
      emitChange: () => field.onChange()
    })

    const canUpdateValue = computed(() => !focused.value || readonly.value)

    // Only edits by the user emit change events:
    const setEditedValue = editedValue => {
      value.value = editedValue
      changeOnceEdited.markEdited()
      changeOnceEdited.emitIfDone()
    }

    function onBlur() {
      // Write the value typed into the input before the blur validates it:
      if (enteredValue.value !== null) {
        setEditedValue(enteredValue.value)
        enteredValue.value = null
      }
      field.onBlur()
      changeOnceEdited.emitIfDone()
    }

    watch(showPopup, showPopup => {
      if (!showPopup) {
        changeOnceEdited.emitIfDone()
      }
    })

    return {
      ...field,
      showPopup,

      colorValue: computed({
        get() {
          return tinycolor(enteredValue.value || value.value || '#000000')
        },

        set(color) {
          enteredValue.value = null
          // Skip unchanged colors, as converting formats like `hsl` back and
          // forth isn't lossless and would cause endless updates.
          if (
            !value.value ||
            color.toHex8String() !== tinycolor(value.value).toHex8String()
          ) {
            setEditedValue(color)
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
          if (tinycolor(hex).isValid()) {
            if (canUpdateValue.value) {
              setEditedValue(hex)
            } else {
              // Store to write on blur, see `onBlur()`:
              enteredValue.value = hex
            }
          }
        }
      }),

      alpha: computed(() =>
        getSchemaValue('alpha', { type: Boolean, default: false })
      ),

      inputs: computed(() =>
        getSchemaValue('inputs', { type: Boolean, default: true })
      ),

      presets: computed(() =>
        getSchemaValue('presets', { type: Array, default: defaultPresets })
      ),

      clear() {
        // Replace the pending edits, as clearing emits its own change event:
        enteredValue.value = null
        changeOnceEdited.reset()
        field.clear()
      }
    }
  }
}

defineType({
  ...colorTraits,
  type: 'color',
  component: DitoColorType,
  hasFormat: true,

  setupSchema({ schema, name }) {
    assertRemovedSchemaKeys(schema, name, { format: `'colorFormat'` })
    if (schema.colorFormat === 'name') {
      throw new Error(`Unsupported color format: 'name'.`)
    }
  }
})

export default DitoColorType

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
