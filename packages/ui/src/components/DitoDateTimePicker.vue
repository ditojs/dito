<template lang="pug">
DitoPickerInput.dito-date-time-picker(
  ref="pickerInput"
  v-bind="{ modelValue, transition, disabled, placeholder, formatOptions }"
  :placement="activePanel === 'time' ? 'bottom-right' : 'bottom-left'"
  icon="calendar"
  toggleLabel="Choose date and time"
  inputClass="dito-date-time-picker__input"
  :inputAttributes="$attrs"
  :handlePanelKey="handlePanelKey"
  @update:modelValue="value => $emit('update:modelValue', value)"
  @change="value => $emit('change', value)"
  @focus="$emit('focus')"
  @blur="$emit('blur')"
  @caret-part-change="onCaretPartChange"
)
  template(#prefix)
    slot(name="prefix")
  template(#suffix)
    slot(name="suffix")
  template(#popup="{ value, setValue, close }")
    DitoCalendar.dito-date-picker-popup(
      v-if="activePanel === 'date'"
      ref="calendar"
      :modelValue="value"
      :locale="locale"
      @update:modelValue="setValue"
      @select="close"
    )
    DitoTimePanel(
      v-else
      ref="timePanel"
      :modelValue="value"
      @update:modelValue="setValue"
      @select="close"
    )
</template>

<script>
import { defaultFormats, assignDeeply } from '@ditojs/utils'
import DitoPickerInput from './DitoPickerInput.vue'
import DitoCalendar from './DitoCalendar.vue'
import DitoTimePanel from './DitoTimePanel.vue'
import { isTimePartName } from '../utils/time.js'

// Shows a calendar below the date and a time panel below the time, depending
// on where the caret is in the input.
export default {
  components: { DitoPickerInput, DitoCalendar, DitoTimePanel },
  emits: ['update:modelValue', 'change', 'focus', 'blur'],
  inheritAttrs: false,

  props: {
    modelValue: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    placeholder: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    locale: { type: String, default: 'en-US' },
    format: { type: Object, default: null }
  },

  data() {
    return {
      // The panel that the popup shows, 'date' or 'time'.
      activePanel: 'date'
    }
  },

  computed: {
    formatOptions() {
      return assignDeeply(
        {
          locale: this.locale,
          time: defaultFormats.time,
          date: defaultFormats.date
        },
        {
          date: {
            month: 'short',
            format: (value, type, options) =>
              type === 'literal' && /\bat\b/.test(value)
                ? ', '
                : this.format?.date?.format?.(value, type, options) ?? value
          }
        },
        this.format
      )
    }
  },

  methods: {
    getPanelForPart(name) {
      return isTimePartName(name) ? 'time' : 'date'
    },

    onCaretPartChange(name) {
      const panel = this.getPanelForPart(name)
      if (panel !== this.activePanel) {
        this.activePanel = panel
        // Show the other panel, also if the popup was closed for this one.
        this.$refs.pickerInput.open()
      }
    },

    handlePanelKey(event, part) {
      // Only the shown panel handles keys, see `onCaretPartChange()` for how
      // it follows the caret.
      if (this.getPanelForPart(part?.name) !== this.activePanel) {
        return false
      }
      const { calendar, timePanel } = this.$refs
      const panel = this.activePanel === 'time' ? timePanel : calendar
      return panel?.handleKey(event, part) ?? false
    },

    focus() {
      this.$refs.pickerInput.focus()
    },

    blur() {
      this.$refs.pickerInput.blur()
    }
  }
}
</script>

<style lang="scss">
.dito-date-time-picker {
  .dito-input {
    min-width: 12em;
  }
}
</style>
