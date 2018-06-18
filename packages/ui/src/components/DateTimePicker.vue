<template lang="pug">
  .dito-date-time-picker(
    ref="picker"
  )
    .dito-pickers(
      :class="{ 'dito-focus': showDate || showTime }"
    )
      date-picker(
        ref="date"
        v-model="date"
        placement="bottom-left"
        :target="$refs.picker"
        :show.sync="showDate"
        @focus="$emit('focus')"
        @blur="$emit('blur')"
        v-bind="{ transition, placeholder, format, locale, disabled }"
      )
      time-picker(
        ref="time"
        v-model="date"
        placeholder=""
        placement="bottom-right"
        :target="$refs.picker"
        :show.sync="showTime"
        @focus="$emit('focus')"
        @blur="$emit('blur')"
        v-bind="{ transition, disabled }"
      )
</template>

<style lang="sass">
  @import '../styles/index'
  .dito-date-time-picker
    // display: inline-block
    .dito-pickers
      @extend %input
      padding: 0
      display: flex
      .dito-input
        border: 0
        box-shadow: none
    .dito-date-picker
      width: 60%
      min-width: 6.9em
      .dito-input
        background: none
        padding-right: 0
    .dito-time-picker
      width: 40%
      min-width: 5.4em
      .dito-input
        background: none
        padding-left: 0
        text-align: right
</style>

<script>
import DatePicker from './DatePicker'
import TimePicker from './TimePicker'

export default {
  components: { DatePicker, TimePicker },

  props: {
    value: {
      type: Date,
      default: null
    },
    transition: {
      type: String,
      default: 'slide'
    },
    placeholder: {
      type: String,
      default: null
    },
    format: {
      type: String,
      default: 'yyyy-MM-dd'
    },
    locale: {
      type: String,
      default: 'en-US'
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      date: this.value,
      showDate: false,
      showTime: false
    }
  },

  watch: {
    value(newVal, oldVal) {
      if (+newVal !== +oldVal) {
        this.date = newVal
      }
    },

    date(date) {
      if (+date !== +this.value) {
        this.$emit('input', date)
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
