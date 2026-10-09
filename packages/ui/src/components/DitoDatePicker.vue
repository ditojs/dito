<!-- Derived from ATUI, and further extended: https://aliqin.github.io/atui/ -->
<template lang="pug">
DitoPickerInput.dito-date-picker(
  ref="pickerInput"
  v-bind="{ modelValue, show, transition, placement, target, disabled }"
  :placeholder="placeholder"
  :formatOptions="formatOptions"
  icon="calendar"
  toggleLabel="Choose date"
  inputClass="dito-date-picker-input"
  :inputAttributes="$attrs"
  :isValueDisabled="disabledDate"
  :handlePanelKey="handlePanelKey"
  @update:modelValue="value => $emit('update:modelValue', value)"
  @update:show="show => $emit('update:show', show)"
  @change="value => $emit('change', value)"
  @focus="$emit('focus')"
  @blur="$emit('blur')"
)
  template(
    v-if="$slots.trigger"
    #trigger
  )
    slot(name="trigger")
  template(#prefix)
    slot(name="prefix")
  template(#suffix)
    slot(name="suffix")
  template(#popup="{ value, setValue, close }")
    DitoCalendar.dito-date-picker-popup(
      ref="calendar"
      :modelValue="value"
      v-bind="{ locale, disabledDate }"
      @update:modelValue="setValue"
      @select="close"
    )
</template>

<script>
import { defaultFormats } from '@ditojs/utils'
import DitoPickerInput from './DitoPickerInput.vue'
import DitoCalendar from './DitoCalendar.vue'

export default {
  components: { DitoPickerInput, DitoCalendar },
  emits: ['update:modelValue', 'update:show', 'change', 'focus', 'blur'],
  inheritAttrs: false,

  props: {
    modelValue: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    placement: { type: String, default: 'bottom-left' },
    placeholder: { type: String, default: null },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    target: { type: [String, HTMLElement], default: 'trigger' },
    locale: { type: String, default: 'en-US' },
    format: {
      type: Object,
      default: () => ({
        date: defaultFormats.date,
        time: false
      })
    },
    disabledDate: { type: Function, default: () => false }
  },

  computed: {
    formatOptions() {
      return {
        locale: this.locale,
        ...this.format
      }
    }
  },

  methods: {
    handlePanelKey(event, part) {
      return this.$refs.calendar?.handleKey(event, part) ?? false
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
@import '../styles/_imports';

.dito-date-picker {
  .dito-input {
    min-width: 8em;
  }
}

.dito-date-picker-popup {
  margin: $popup-margin;
}
</style>
