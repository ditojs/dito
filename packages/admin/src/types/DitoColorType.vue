<template lang="pug">
.dito-color(ref="root")
  PopoverRoot(
    v-model:open="showPopup"
  )
    //- The popup is placed at the input, which opens it along with the swatch
    //- button:
    PopoverAnchor(asChild)
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
            v-if="inputAffixesProps.hasPrefix"
            position="prefix"
            v-bind="inputAffixesProps.prefix"
          )
        template(#suffix)
          DitoInputAffixes(
            v-if="inputAffixesProps.hasSuffix"
            position="suffix"
            v-bind="inputAffixesProps.suffix"
            @clear="clear"
          )
          //- Outside of the affixes, so their clear button doesn't hide it.
          //- Its clicks don't focus the input, which would open the popup
          //- before they close it again:
          PopoverTrigger.dito-color__preview(
            aria-label="Choose color"
            :disabled="disabled || readonly"
            @mousedown.stop
          )
            div(:style="{ background: `#${hexValue || '00000000'}` }")
    //- No portal, so that the styles apply:
    PopoverContent.dito-color__popup(
      v-bind="placement"
      align="start"
      :sideOffset="2"
      @open-auto-focus="keepInputFocused"
      @close-auto-focus="keepInputFocused"
      @interact-outside="onInteractOutside"
    )
      ColorAreaRoot(
        v-slot="{ style }"
        :modelValue="pickerColor"
        colorSpace="hsb"
        xChannel="saturation"
        yChannel="brightness"
        @update:color="setPickerColor"
      )
        ColorAreaArea.dito-color__area(:style="style")
          ColorAreaThumb.dito-color__thumb
      ColorSliderRoot.dito-color__slider(
        v-for="channel in sliderChannels"
        :key="channel"
        :modelValue="pickerColor"
        colorSpace="hsb"
        :channel="channel"
        @update:color="setPickerColor"
      )
        ColorSliderTrack.dito-color__track
        ColorSliderThumb.dito-color__handle
      .dito-color__fields(
        v-if="inputs"
      )
        ColorFieldRoot.dito-color__field(
          v-for="channel in fieldChannels"
          :key="channel"
          :modelValue="pickerColor"
          colorSpace="hsb"
          :channel="channel"
          @update:color="setPickerColor"
        )
          label(:for="`${componentPath}-${channel}`")
            | {{ getChannelName(channel)[0] }}
          ColorFieldInput.dito-input(
            :id="`${componentPath}-${channel}`"
            :aria-label="getChannelName(channel)"
          )
      .dito-color__presets
        button.dito-color__preset(
          v-for="preset in presets"
          :key="preset"
          type="button"
          :title="preset"
          @click="setPickerColor(preset)"
        )
          ColorSwatch.dito-color__swatch(:color="preset")
</template>

<script>
import tinycolor from 'tinycolor2'
import { isString } from '@ditojs/utils'
import {
  ColorAreaArea,
  ColorAreaRoot,
  ColorAreaThumb,
  ColorFieldInput,
  ColorFieldRoot,
  ColorSliderRoot,
  ColorSliderThumb,
  ColorSliderTrack,
  ColorSwatch,
  PopoverAnchor,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  convertToRgb,
  getChannelName
} from 'reka-ui'
import { DitoInput, usePopupPlacement } from '@ditojs/ui/src'
import {
  computed,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { colorTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import { createChangeOnceEdited } from '../utils/changeOnceEdited.js'

// @vue/component
const DitoColorType = {
  components: {
    ColorAreaArea,
    ColorAreaRoot,
    ColorAreaThumb,
    ColorFieldInput,
    ColorFieldRoot,
    ColorSliderRoot,
    ColorSliderThumb,
    ColorSliderTrack,
    ColorSwatch,
    DitoInput,
    DitoInputAffixes,
    PopoverAnchor,
    PopoverContent,
    PopoverRoot,
    PopoverTrigger
  },
  props: fieldProps,

  setup(props) {
    const field = useField(props, {
      // Native change events don't tell when editing is done, as the picker
      // edits the value too. Swallow them, see `changeOnceEdited`:
      getEvents: ({ onFocus }) => ({
        onFocus: () => {
          onFocus()
          openPopup()
        },
        // Open the popup again after it was closed while the input kept the
        // focus:
        onClick: openPopup,
        onBlur,
        onChange: () => {}
      })
    })
    const { value, focused, readonly, getSchemaValue } = field
    const showPopup = ref(false)
    const alpha = computed(() =>
      getSchemaValue('alpha', { type: Boolean, default: false })
    )
    // The value of the input while it can't be written, see `hexValue`:
    const enteredValue = ref(null)
    // The color picked last, which keeps the hue of grays:
    const pickedColor = ref(null)

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

    function openPopup() {
      if (!readonly.value) {
        showPopup.value = true
      }
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

    const root = useTemplateRef('root')
    const placement = usePopupPlacement(() => root.value)

    watch(showPopup, showPopup => {
      if (!showPopup) {
        changeOnceEdited.emitIfDone()
      }
    })

    return {
      ...field,
      showPopup,
      placement,
      getChannelName,

      // reka-ui focuses the popup when it opens, and the button when it
      // closes, which a focused input prevents:
      keepInputFocused(event) {
        if (focused.value) {
          event.preventDefault()
        }
      },

      // Clicks on the input and its affixes keep the popup open:
      onInteractOutside(event) {
        const { target } = event
        if (root.value.contains(target) && !target.closest('button')) {
          event.preventDefault()
        }
      },

      // The picker's color in reka-ui's HSB space, which its area needs for
      // its saturation:
      pickerColor: computed(() => {
        const color = tinycolor(enteredValue.value || value.value || '#000000')
        // Grays, black and white lose their hue in the value, so keep the
        // picked color while it matches:
        if (
          pickedColor.value &&
          toTinyColor(pickedColor.value).toHex8String() === color.toHex8String()
        ) {
          return pickedColor.value
        } else {
          const { h, s, v, a } = color.toHsv()
          return { space: 'hsb', h, s: s * 100, b: v * 100, alpha: a }
        }
      }),

      setPickerColor(color) {
        const picked = toTinyColor(color)
        // Presets are hex strings, which `pickerColor` converts itself:
        pickedColor.value = isString(color) ? null : color
        enteredValue.value = null
        // Keep the value's format when the same color is picked:
        if (
          !value.value ||
          picked.toHex8String() !== tinycolor(value.value).toHex8String()
        ) {
          setEditedValue(picked)
        }
      },

      hexValue: computed({
        get() {
          const color = tinycolor(value.value)
          return color.isValid() ? getHex(color).slice(1).toLowerCase() : null
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

      alpha,

      inputs: computed(() =>
        getSchemaValue('inputs', { type: Boolean, default: true })
      ),

      sliderChannels: computed(() =>
        alpha.value ? ['hue', 'alpha'] : ['hue']
      ),

      fieldChannels: computed(() =>
        alpha.value
          ? ['red', 'green', 'blue', 'alpha']
          : ['red', 'green', 'blue']
      ),

      // reka-ui reads hex colors, the presets can be in any CSS format:
      presets: computed(() =>
        getSchemaValue('presets', { type: Array, default: defaultPresets }).map(
          preset => getHex(tinycolor(preset))
        )
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
  hasInputAffixes: true,

  setupSchema({ schema }) {
    if (schema.colorFormat === 'name') {
      throw new Error(`Unsupported color format: 'name'.`)
    }
  }
})

export default DitoColorType

// Eight digits only with transparency, like reka-ui's hex colors:
function getHex(color) {
  return color.toString(color.getAlpha() < 1 ? 'hex8' : 'hex6')
}

// reka-ui's colors are objects in its color spaces, the presets hex strings:
function toTinyColor(color) {
  if (isString(color)) {
    return tinycolor(color)
  }
  const { r, g, b, alpha } = convertToRgb(color)
  return tinycolor({ r, g, b, a: alpha })
}

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

$color-swatch-width: $pattern-transparency-size;
$color-swatch-radius: $border-radius - $border-width;
$color-picker-gap: 8px;
$color-slider-height: 12px;

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

  &__popup {
    @extend %popup--animated;

    display: flex;
    flex-flow: column;
    gap: $color-picker-gap;
    box-sizing: border-box;
    // As wide as the input:
    width: var(--reka-popover-trigger-width);
    padding: $color-picker-gap;
  }

  &__area {
    position: relative;
    height: 150px;
    border-radius: $color-swatch-radius;
  }

  &__slider {
    display: flex;
    position: relative;
    align-items: center;
    height: $color-slider-height;
    // The transparency shows through the alpha slider's track:
    background: $pattern-transparency;
    background-size: $color-slider-height $color-slider-height;
    border-radius: $color-swatch-radius;
  }

  &__track {
    flex: 1;
    align-self: stretch;
    border-radius: inherit;
  }

  &__thumb {
    width: $color-slider-height;
    height: $color-slider-height;
    box-sizing: border-box;
    border: 2px solid $color-white;
    border-radius: 50%;
    box-shadow:
      0 0 0 1px $color-shadow,
      inset 0 0 0 1px $color-shadow;

    &:focus-visible {
      @include focus-ring;
    }
  }

  // The sliders have an upright bar instead of the area's circle:
  &__handle {
    width: 4px;
    height: $color-slider-height;
    border-radius: 2px;
    background: $color-white;
    box-shadow: 0 0 2px rgba($color-black, 0.6);

    &:focus-visible {
      @include focus-ring;
    }
  }

  &__fields {
    display: flex;
    gap: $color-picker-gap;
  }

  &__field {
    display: flex;
    flex: 1;
    align-items: center;
    gap: $color-picker-gap * 0.5;
    min-width: 0;

    .dito-input {
      flex: 1;
      min-width: 0;
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
    }
  }

  &__presets {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: $color-picker-gap;
    padding-top: $color-picker-gap;
    border-top: $border-style;
  }

  &__preset {
    @extend %button--plain;

    border-radius: $color-swatch-radius;
    background: $pattern-transparency;
    background-size: $color-slider-height $color-slider-height;

    &:focus-visible {
      @include focus-ring;
    }
  }

  &__swatch {
    aspect-ratio: 1;
    border-radius: inherit;
    background: var(--reka-color-swatch-color);
    box-shadow: inset 0 0 0 1px $color-shadow;
  }

  &__preview {
    // A button, sized like the `div` inside it, plus its border:
    @extend %button--plain;

    box-sizing: content-box;
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

    &:focus-visible {
      @include focus-ring($inset: true);
    }

    &:disabled {
      cursor: default;
    }
  }

  // Inherit input focus state
  .dito-input:focus-within &__preview,
  .dito-input--focus &__preview {
    border-left-color: $color-active;
  }
}
</style>
