<template lang="pug">
DitoPickerInput.dito-date-time-picker(
  ref="pickerInput"
  v-bind="{ modelValue, show, transition, placement, target, disabled }"
  :matchTargetWidth="false"
  :placeholder="placeholder"
  :formatOptions="formatOptions"
  icon="calendar"
  toggleLabel="Choose date and time"
  inputClass="dito-date-time-picker__input"
  :inputAttributes="$attrs"
  @update:modelValue="value => $emit('update:modelValue', value)"
  @update:show="show => $emit('update:show', show)"
  @change="value => $emit('change', value)"
  @focus="$emit('focus')"
  @blur="$emit('blur')"
)
  template(#prefix)
    slot(name="prefix")
  template(#suffix)
    slot(name="suffix")
  template(#popup="{ value, setValue, close }")
    //- Picking a day keeps the popup open for the time, Enter in the time
    //- closes it:
    .dito-date-time-picker__popup
      DitoCalendar.dito-date-picker-popup(
        :modelValue="value"
        :locale="locale"
        @update:modelValue="setValue"
      )
      DitoTimePanel(
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

// Shows a calendar and a time panel next to each other.
export default {
  components: { DitoPickerInput, DitoCalendar, DitoTimePanel },
  emits: ['update:modelValue', 'update:show', 'change', 'focus', 'blur'],
  inheritAttrs: false,

  props: {
    modelValue: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    placement: { type: String, default: 'bottom-left' },
    placeholder: { type: String, default: null },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    target: { type: HTMLElement, default: null },
    locale: { type: String, default: 'en-US' },
    format: { type: Object, default: null }
  },

  computed: {
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

// The calendar is as wide as the input, the time panel next to it:
.dito-date-time-picker__popup {
  display: flex;
  align-items: flex-start;

  .dito-calendar {
    width: var(--reka-popover-trigger-width);
  }

  .dito-time-picker-popup {
    flex: none;
    width: 160px;
  }
}
</style>
