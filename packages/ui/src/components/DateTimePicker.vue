<template lang="pug">
  .dito-date-time-picker(
    ref="picker"
  )
    .dito-pickers(
      :class="{ 'dito-focus': focused }"
    )
      date-picker(
        ref="date"
        v-model="currentValue"
        placement="bottom-left"
        :target="$refs.picker"
        :show.sync="showDate"
        @focus="dateFocused = true"
        @blur="dateFocused = false"
        v-bind="{ transition, placeholder, locale, dateFormat, disabled }"
      )
      time-picker(
        ref="time"
        v-model="currentValue"
        placeholder=""
        placement="bottom-right"
        :target="$refs.picker"
        :show.sync="showTime"
        @focus="timeFocused = true"
        @blur="timeFocused = false"
        v-bind="{ transition, disabled }"
      )
</template>

<style lang="sass">
  .dito-date-time-picker
    .dito-pickers
      @extend %input
      padding: 0
      display: flex
      .dito-input
        background: none
        border: 0
    .dito-date-picker
      width: 60%
      min-width: 6.9em
      .dito-input
        padding-right: 0
    .dito-time-picker
      width: 40%
      min-width: 5.4em
      .dito-input
        padding-left: 0
        text-align: right
</style>

<script>
import { defaultFormats } from '@ditojs/utils'
import DatePicker from './DatePicker.vue'
import TimePicker from './TimePicker.vue'

export default {
  components: { DatePicker, TimePicker },

  props: {
    value: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    placeholder: { type: String, default: null },
    dateFormat: { type: Object, default: () => defaultFormats.date },
    locale: { type: String, default: 'en-US' },
    disabled: { type: Boolean, default: false }
  },

  data() {
    return {
      currentValue: this.value,
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
    value(newVal, oldVal) {
      if (+newVal !== +oldVal) {
        this.currentValue = newVal
      }
    },

    currentValue(date) {
      if (+date !== +this.value) {
        this.changed = true
        this.$emit('input', date)
      }
    },

    focused(newVal, oldVal) {
      if (!newVal !== !oldVal) {
        this.$emit(newVal ? 'focus' : 'blur')
      }
    }
  },

  mounted() {
    this.$on('blur', () => {
      if (this.changed) {
        this.changed = false
        this.$emit('change', this.currentValue)
      }
    })
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
