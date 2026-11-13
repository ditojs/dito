<template lang="pug">
DitoTrigger.dito-picker-input(
  ref="trigger"
  v-bind="{ show, transition, placement, disabled, target, matchTargetWidth }"
  @update:show="onUpdateShow"
  @closed="isPopupClosing = false"
)
  template(#trigger)
    slot(
      v-if="$slots.trigger"
      name="trigger"
    )
    DitoInput(
      v-else
      ref="input"
      :modelValue="currentText"
      type="text"
      :class="inputClass"
      v-bind="{ placeholder, disabled, focused: isFocused, ...inputAttributes }"
      @update:modelValue="onInputText"
      @focus="isInputFocused = true"
      @blur="isInputFocused = false"
      @keydown="onInputKeyDown"
    )
      template(#prefix)
        slot(name="prefix")
      template(#suffix)
        PopoverTrigger.dito-picker-input__toggle(
          type="button"
          :aria-label="toggleLabel"
          :disabled="disabled"
          @focus="isToggleFocused = true"
          @blur="isToggleFocused = false"
        )
          DitoIcon(
            :name="icon"
            :disabled="disabled"
          )
        slot(name="suffix")
  template(#popup)
    slot(
      name="popup"
      :value="currentValue"
      :setValue="setValue"
      :close="close"
    )
</template>

<script>
import { format } from '@ditojs/utils'
import { PopoverTrigger } from 'reka-ui'
import DitoTrigger from './DitoTrigger.vue'
import DitoInput from './DitoInput.vue'
import DitoIcon from './DitoIcon.vue'
import {
  alterDate,
  describeDate,
  getDatePartAtPosition,
  parseDate,
  stepDate
} from '../utils/date.js'
import { getSelection, setSelection } from '../utils/selection.js'
import { getKeyNavigation } from '../utils/event.js'
import { isTimePartName, editTimeText } from '../utils/time.js'

// The input of the date and time pickers, with the icon button that toggles
// their popup. It owns the picked value, the text that represents it and the
// focus state of input, button and popup together. The popup's panel is
// rendered through the `popup` slot, and takes the focus when it opens.
export default {
  components: { DitoTrigger, DitoInput, DitoIcon, PopoverTrigger },
  emits: [
    'update:modelValue',
    'update:show',
    'change',
    'focus',
    'blur'
  ],

  props: {
    modelValue: { type: Date, default: null },
    formatOptions: { type: Object, required: true },
    icon: { type: String, required: true },
    toggleLabel: { type: String, required: true },
    placeholder: { type: String, default: null },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    transition: { type: String, default: 'slide' },
    placement: { type: String, default: 'bottom-left' },
    target: { type: HTMLElement, default: null },
    matchTargetWidth: { type: Boolean, default: true },
    inputClass: { type: String, default: null },
    // The attributes and listeners of the native input.
    inputAttributes: { type: Object, default: () => ({}) }
  },

  data() {
    return {
      currentValue: this.modelValue,
      // The typed text, which isn't always a date.
      currentText: format(this.modelValue, this.formatOptions) || '',
      isPopupShown: this.show,
      // Whether the popup is closing, until the focus has moved on from it.
      isPopupClosing: false,
      isInputFocused: false,
      isToggleFocused: false,
      isEdited: false
    }
  },

  computed: {
    isFocused() {
      return (
        this.isInputFocused ||
        this.isToggleFocused ||
        this.isPopupShown ||
        this.isPopupClosing
      )
    },

    valueText() {
      return format(this.currentValue, this.formatOptions) || ''
    }
  },

  watch: {
    modelValue(to, from) {
      if (+to !== +from) {
        this.currentValue = to
      }
    },

    valueText(text) {
      this.currentText = text
    },

    isFocused(to, from) {
      if (to ^ from) {
        if (!to) {
          this.emitChangeIfEdited()
          // Drop typed text that isn't a date, so the input shows the value:
          this.currentText = this.valueText
        }
        this.$emit(to ? 'focus' : 'blur')
      }
    }
  },

  methods: {
    getInputElement() {
      return this.$refs.input?.input ?? null
    },

    setValue(value) {
      if (+value !== +this.currentValue) {
        this.currentValue = value
        if (+value !== +this.modelValue) {
          this.isEdited = true
          this.$emit('update:modelValue', value)
        }
      }
    },

    // Emit `change` once the edit is done: when the popup closes, the input
    // loses focus or Enter is pressed.
    emitChangeIfEdited() {
      if (this.isEdited) {
        this.isEdited = false
        this.$emit('change', this.currentValue)
      }
    },

    open() {
      this.$refs.trigger.open()
    },

    close() {
      this.$refs.trigger.close()
    },

    focus() {
      this.$refs.input?.focus()
    },

    blur() {
      this.$refs.input?.blur()
    },

    getCaretPart() {
      const position = getSelection(this.getInputElement())?.start
      return position != null
        ? getDatePartAtPosition(this.currentText, position, this.formatOptions)
        : null
    },

    onUpdateShow(show) {
      // `DitoTrigger` owns the popup's state, this only mirrors it.
      this.isPopupShown = show
      this.isPopupClosing = !show
      if (!show) {
        this.emitChangeIfEdited()
      }
      this.$emit('update:show', show)
    },

    onInputText(text) {
      this.currentText = text
      const date = parseDate(text, this.formatOptions)
      if (date) {
        // Keep the caret in place while the text is replaced with the one of
        // the new value.
        const input = this.getInputElement()
        const selection = getSelection(input)
        this.setValue(date)
        if (selection) {
          this.$nextTick(() => setSelection(input, selection))
        }
      }
    },

    // Steps the date part `part` of the value, and selects it again once the
    // text shows the new value. Time parts wrap around without changing the
    // date:
    stepPart(part, step) {
      const { name } = part
      const date = this.currentValue
      const length = { hour: 24, minute: 60, second: 60 }[name]
      this.setValue(
        length
          ? alterDate(date, {
              [name]: (describeDate(date)[name] + step + length) % length
            })
          : stepDate(date, name, step)
      )
      const input = this.getInputElement()
      this.$nextTick(() => {
        setSelection(
          input,
          getDatePartAtPosition(
            this.currentText,
            part.start,
            this.formatOptions
          )
        )
      })
    },

    onInputKeyDown(event) {
      const { ver: step, enter } = getKeyNavigation(event)
      const part = this.getCaretPart()
      if (step) {
        event.preventDefault()
        // The arrow keys step the part at the caret. With Alt, or without a
        // part to step, they open the popup, which takes the focus:
        if (event.altKey || !this.currentValue || !part) {
          this.open()
        } else {
          this.stepPart(part, step)
        }
      } else if (enter) {
        event.preventDefault()
        this.emitChangeIfEdited()
      } else if (isTimePartName(part?.name)) {
        editTimeText(event, this.getInputElement(), this.currentText.length)
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-picker-input {
  $self: &;

  .dito-input {
    font-variant-numeric: tabular-nums;
    width: 100%;
  }

  &__toggle {
    display: flex;
    padding: 0;
    border: 0;
    border-radius: $border-radius;
    font: inherit;
    color: $color-grey;
    background: none;

    @at-root #{$self}:focus-within & {
      color: $color-active;
    }

    &:disabled {
      cursor: default;
    }

    &:focus-visible {
      @include focus-ring;
    }
  }
}
</style>
