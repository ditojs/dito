<template lang="pug">
.dito-date-time-picker(ref="picker")
  .dito-pickers(:class="{ 'dito-focus': focused }")
    DatePicker(
      ref="date"
      v-model="currentValue"
      v-model:show="showDate"
      placement="bottom-left"
      :target="$refs.picker"
      v-bind="{ transition, placeholder, locale, dateFormat, disabled }"
      @focus="dateFocused = true"
      @blur="dateFocused = false"
    )
    TimePicker(
      ref="time"
      v-model="currentValue"
      v-model:show="showTime"
      placeholder=""
      placement="bottom-right"
      :target="$refs.picker"
      v-bind="{ transition, disabled }"
      @focus="timeFocused = true"
      @blur="timeFocused = false"
    )
</template>

<script>
import { defaultFormats } from '@ditojs/utils'
import DatePicker from './DatePicker.vue'
import TimePicker from './TimePicker.vue'

export default {
  components: { DatePicker, TimePicker },
  emits: ['update:modelValue', 'change', 'focus', 'blur'],

  props: {
    modelValue: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    placeholder: { type: String, default: null },
    dateFormat: { type: Object, default: () => defaultFormats.date },
    locale: { type: String, default: 'en-US' },
    disabled: { type: Boolean, default: false }
  },

  data() {
    return {
      currentValue: this.modelValue,
      showDate: false,
      showTime: false,
      dateFocused: false,
      timeFocused: false,
      changed: false
    }
  },

  computed: {
    focused() {
      return this.dateFocused || this.timeFocused
    }
  },

  watch: {
    modelValue(to, from) {
      if (+to !== +from) {
        this.currentValue = to
      }
    },

    currentValue(date) {
      if (+date !== +this.modelValue) {
        this.changed = true
        this.$emit('update:modelValue', date)
      }
    },

    focused(to, from) {
      if (to ^ from) {
        this.$emit(to ? 'focus' : 'blur')
        if (!to && this.changed) {
          this.changed = false
          this.$emit('change', this.currentValue)
        }
      }
    }
  },

  methods: {
    focus() {
      this.$refs.date.focus()
    },

    blur() {
      this.$refs.date.blur()
      this.$refs.time.blur()
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-date-time-picker {
  .dito-pickers {
    @extend %input;

    padding: 0;
    display: flex;

    .dito-input {
      background: none;
      border: 0;
    }
  }

  .dito-date-picker {
    width: 60%;
    min-width: 6.9em;

    .dito-input {
      padding-right: 0;
    }
  }

  .dito-time-picker {
    width: 40%;
    min-width: 5.4em;

    .dito-input {
      padding-left: 0;
      text-align: right;
    }
  }
}
</style>
