<template lang="pug">
DitoTrigger.dito-picker-input(
  ref="trigger"
  trigger="focus"
  v-bind="{ show, transition, placement, disabled, target }"
  @update:show="onUpdateShow"
)
  template(#trigger)
    slot(
      v-if="$slots.trigger"
      name="trigger"
    )
    DitoInput(
      v-else
      ref="input"
      v-model="currentText"
      type="text"
      :class="inputClass"
      v-bind="{ placeholder, disabled, focused: isFocused, ...inputAttributes }"
      @focus="onInputFocus"
      @blur="isInputFocused = false"
      @click="onInputClick"
      @keydown="onInputKeyDown"
      @keyup="updateCaretPart"
    )
      template(#prefix)
        slot(name="prefix")
      template(#suffix)
        button.dito-picker-input__toggle(
          type="button"
          :aria-label="toggleLabel"
          aria-haspopup="dialog"
          :aria-expanded="isPopupShown ? 'true' : 'false'"
          :disabled="disabled"
          @mousedown.stop.prevent
          @click="onToggleClick"
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
import DitoTrigger from './DitoTrigger.vue'
import DitoInput from './DitoInput.vue'
import DitoIcon from './DitoIcon.vue'
import { parseDate, getDatePartAtPosition } from '../utils/date.js'
import { getSelection, setSelection } from '../utils/selection.js'
import { getKeyNavigation } from '../utils/event.js'
import { isTimePartName, editTimeText } from '../utils/time.js'

// The input of the date and time pickers, with the icon button that toggles
// their popup. It owns the picked value, the text that represents it and the
// focus state of input and popup together. The popup's panel is rendered
// through the `popup` slot, and navigated with the keyboard through
// `handlePanelKey()`.
export default {
  components: { DitoTrigger, DitoInput, DitoIcon },
  emits: [
    'update:modelValue',
    'update:show',
    'change',
    'focus',
    'blur',
    'caretPartChange'
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
    target: { type: [String, HTMLElement], default: 'trigger' },
    inputClass: { type: String, default: null },
    // The attributes and listeners of the native input.
    inputAttributes: { type: Object, default: () => ({}) },
    // Values that can't be picked, also not by typing them.
    isValueDisabled: { type: Function, default: () => false },
    // Called with the keydown event of the input and the date part at the
    // caret, returning whether the panel handled it.
    handlePanelKey: { type: Function, default: () => false }
  },

  data() {
    return {
      currentValue: this.modelValue,
      isPopupShown: this.show,
      isInputFocused: false,
      caretPartName: null
    }
  },

  computed: {
    isFocused() {
      return this.isInputFocused || this.isPopupShown
    },

    currentText: {
      get() {
        return format(this.currentValue, this.formatOptions) || ''
      },

      set(text) {
        const date = parseDate(text, this.formatOptions)
        if (date) {
          // Keep the caret in place while the text is replaced with the one
          // of the new value.
          const input = this.getInputElement()
          const selection = getSelection(input)
          if (this.setValue(date) && selection) {
            this.$nextTick(() => setSelection(input, selection))
          }
        }
      }
    }
  },

  watch: {
    modelValue(to, from) {
      if (+to !== +from) {
        this.currentValue = to
      }
    },

    isFocused(to, from) {
      if (to ^ from) {
        this.$emit(to ? 'focus' : 'blur')
      }
    }
  },

  methods: {
    getInputElement() {
      return this.$refs.input?.input ?? null
    },

    // All changes of the value go through here, so disabled values are never
    // set. Returns whether the value was set.
    setValue(value) {
      if (value && this.isValueDisabled(value)) {
        return false
      }
      if (+value !== +this.currentValue) {
        this.currentValue = value
        if (+value !== +this.modelValue) {
          this.$emit('update:modelValue', value)
          this.$emit('change', value)
        }
      }
      return true
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

    updateCaretPart() {
      const name = this.getCaretPart()?.name ?? null
      if (name !== this.caretPartName) {
        this.caretPartName = name
        this.$emit('caretPartChange', name)
      }
    },

    onUpdateShow(show) {
      // `DitoTrigger` owns the popup's state, this only mirrors it.
      this.isPopupShown = show
      this.$emit('update:show', show)
    },

    onInputFocus() {
      this.isInputFocused = true
      this.updateCaretPart()
    },

    onInputClick() {
      this.updateCaretPart()
      // Reopen the popup when clicking into the focused input after it was
      // closed, e.g. with Escape.
      this.open()
    },

    onToggleClick() {
      if (this.isPopupShown) {
        this.close()
      } else {
        this.open()
        this.focus()
      }
    },

    onInputKeyDown(event) {
      const { ver: step, enter } = getKeyNavigation(event)
      const part = this.getCaretPart()
      if (step || enter) {
        event.preventDefault()
        if (!this.isPopupShown) {
          if (step) {
            this.open()
          }
        } else if (this.handlePanelKey(event, part) && part) {
          // Select the changed part again, once the text was updated.
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
        }
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
    color: inherit;
    background: none;

    &:disabled {
      cursor: default;
    }

    &:focus-visible {
      outline: none;
      box-shadow: $shadow-focus;
    }
  }
}
</style>
