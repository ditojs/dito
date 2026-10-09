<!-- Derived from ATUI, and further extended: https://aliqin.github.io/atui/ -->
<template lang="pug">
DitoPickerInput.dito-time-picker(
  ref="pickerInput"
  v-bind="{ modelValue, show, transition, placement, target, disabled }"
  :placeholder="placeholder"
  :formatOptions="formatOptions"
  icon="clock"
  toggleLabel="Choose time"
  inputClass="dito-time-picker-input"
  :inputAttributes="$attrs"
  :isValueDisabled="isValueDisabled"
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
    DitoTimePanel(
      ref="timePanel"
      :modelValue="value"
      v-bind="{ disabledHour, disabledMinute, disabledSecond }"
      @update:modelValue="setValue"
      @select="close"
    )
</template>

<script>
import { defaultFormats } from '@ditojs/utils'
import DitoPickerInput from './DitoPickerInput.vue'
import DitoTimePanel from './DitoTimePanel.vue'
import { isTimeDisabled } from '../utils/time.js'

export default {
  components: { DitoPickerInput, DitoTimePanel },
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
        time: defaultFormats.time,
        date: false
      })
    },
    disabledHour: { type: Function, default: () => false },
    disabledMinute: { type: Function, default: () => false },
    disabledSecond: { type: Function, default: () => false }
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
    isValueDisabled(date) {
      const { disabledHour, disabledMinute, disabledSecond } = this
      return isTimeDisabled(date, {
        disabledHour,
        disabledMinute,
        disabledSecond
      })
    },

    handlePanelKey(event, part) {
      return this.$refs.timePanel?.handleKey(event, part) ?? false
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
.dito-time-picker {
  .dito-input {
    min-width: 6em;
  }
}
</style>
