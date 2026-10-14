<template lang="pug">
DitoPickerInput.dito-date-time-picker(
  ref="pickerInput"
  v-bind="{ modelValue, show, transition, target, disabled }"
  :placement="popupPlacement"
  :placeholder="placeholder"
  :formatOptions="formatOptions"
  icon="calendar"
  toggleLabel="Choose date and time"
  inputClass="dito-date-time-picker__input"
  :inputAttributes="$attrs"
  :handlePanelKey="handlePanelKey"
  @update:modelValue="value => $emit('update:modelValue', value)"
  @update:show="show => $emit('update:show', show)"
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
import { defaultFormats, assignDeeply, isPlainObject } from '@ditojs/utils'
import DitoPickerInput from './DitoPickerInput.vue'
import DitoCalendar from './DitoCalendar.vue'
import DitoTimePanel from './DitoTimePanel.vue'
import { isTimePartName } from '../utils/time.js'

// Shows a calendar below the date and a time panel below the time, depending
// on where the caret is in the input.
export default {
  components: { DitoPickerInput, DitoCalendar, DitoTimePanel },
  emits: ['update:modelValue', 'update:show', 'change', 'focus', 'blur'],
  inheritAttrs: false,

  props: {
    modelValue: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    // Without a placement, the popup follows the panel that it shows:
    placement: { type: String, default: null },
    placeholder: { type: String, default: null },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    target: { type: [String, HTMLElement], default: 'trigger' },
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
    popupPlacement() {
      return (
        this.placement ||
        (this.activePanel === 'time' ? 'bottom-right' : 'bottom-left')
      )
    },

    formatOptions() {
      const options = assignDeeply(
        {
          locale: this.locale,
          time: defaultFormats.time,
          date: defaultFormats.date
        },
        { date: { month: 'short' } },
        this.format
      )
      // Wrap the merged date `format()`, which may be a custom one, to
      // separate the date and time with a comma rather than "at". `date` can
      // also be `true` for the default format, or `false` to omit the date.
      if (isPlainObject(options.date)) {
        const { format } = options.date
        options.date.format = (value, type, formatOptions) =>
          type === 'literal' && /\bat\b/.test(value)
            ? ', '
            : format?.(value, type, formatOptions) ?? value
      }
      return options
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
