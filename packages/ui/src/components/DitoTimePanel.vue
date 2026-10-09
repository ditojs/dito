<template lang="pug">
.dito-time-picker-popup(
  role="dialog"
  aria-label="Choose time"
)
  .dito-time-picker-panel(
    v-for="column in columns"
    :key="column.name"
  )
    ul(
      :ref="element => setListElement(column.name, element)"
      :class="`dito-time-picker-${column.name}`"
      role="listbox"
      :aria-label="column.label"
    )
      li(
        v-for="value in column.values"
        :key="value"
        :ref="element => setOptionElement(column.name, value, element)"
        role="option"
        :aria-label="leftPad(value)"
        :aria-selected="value === column.value"
        :class="{ selected: value === column.value }"
        @click="setTime({ [column.name]: value })"
      ) {{ leftPad(value) }}
</template>

<script>
import { alterDate } from '../utils/date.js'
import { getKeyNavigation } from '../utils/event.js'
import {
  getEnabledValues,
  getEnabledValue,
  stepEnabledValue
} from '../utils/time.js'

// The panel of `DitoTimePicker` and `DitoDateTimePicker`, with a list of the
// enabled values for each of the hour, minute and second. The picker's input
// navigates it through `handleKey()`.
export default {
  emits: ['update:modelValue', 'select'],

  props: {
    modelValue: { type: Date, default: null },
    disabledHour: { type: Function, default: () => false },
    disabledMinute: { type: Function, default: () => false },
    disabledSecond: { type: Function, default: () => false }
  },

  computed: {
    currentDate() {
      return (
        this.modelValue ||
        // Create a new Date() object with the time set to 0, to be used when
        // first setting any of the times, for meaningful dates in case the
        // object is shared with a calendar, e.g. in DateTimePicker.
        alterDate(new Date(), { hour: 0, minute: 0, second: 0, millisecond: 0 })
      )
    },

    // The enabled values of each column, apart from the current date, so they
    // aren't collected again with each change of the time.
    enabledValues() {
      return {
        hour: getEnabledValues(24, this.disabledHour),
        minute: getEnabledValues(60, this.disabledMinute),
        second: getEnabledValues(60, this.disabledSecond)
      }
    },

    columns() {
      const { currentDate, enabledValues } = this
      return [
        {
          name: 'hour',
          label: 'Hour',
          value: currentDate.getHours(),
          values: enabledValues.hour
        },
        {
          name: 'minute',
          label: 'Minute',
          value: currentDate.getMinutes(),
          values: enabledValues.minute
        },
        {
          name: 'second',
          label: 'Second',
          value: currentDate.getSeconds(),
          values: enabledValues.second
        }
      ]
    }
  },

  watch: {
    modelValue(to, from) {
      if (+to !== +from) {
        this.scrollToSelectedOptions({ smooth: true })
      }
    }
  },

  created() {
    // The rendered lists and their options, by column name and value.
    this.listElements = {}
    this.optionElements = { hour: {}, minute: {}, second: {} }
  },

  mounted() {
    this.scrollToSelectedOptions({ smooth: false })
  },

  methods: {
    leftPad(value) {
      return ('0' + value).slice(-2)
    },

    setListElement(name, element) {
      this.listElements[name] = element
    },

    setOptionElement(name, value, element) {
      if (element) {
        this.optionElements[name][value] = element
      } else {
        delete this.optionElements[name][value]
      }
    },

    // All changes of the time go through here, so disabled times are never
    // set: The parts that aren't overridden move on to their next enabled
    // value, so that any part can be picked first.
    setTime(overrides) {
      const time = { millisecond: 0 }
      for (const { name, value, values } of this.columns) {
        time[name] = getEnabledValue(values, overrides[name] ?? value)
        if (time[name] === null) return
      }
      this.$emit('update:modelValue', alterDate(this.currentDate, time))
    },

    // Handles a keydown event of the picker's input, with the caret inside the
    // date part `part`, and returns whether it was handled.
    handleKey(event, part) {
      const { ver: step, enter } = getKeyNavigation(event)
      if (enter) {
        this.$emit('select')
        return true
      }
      const column = (
        step &&
        this.columns.find(({ name }) => name === part?.name)
      )
      if (column) {
        const value = stepEnabledValue(column.values, column.value, step)
        if (value !== null) {
          this.setTime({ [column.name]: value })
        }
        return true
      }
      return false
    },

    scrollToSelectedOptions({ smooth }) {
      this.$nextTick(() => {
        for (const { name, value } of this.columns) {
          const list = this.listElements[name]
          const option = this.optionElements[name][value]
          if (list && option) {
            // Center the selected option in the list.
            const top = Math.round(
              option.offsetTop -
              (list.clientHeight - option.offsetHeight) / 2
            )
            const distance = Math.abs(list.scrollTop - top)
            list.scrollTo({
              top,
              behavior: smooth && distance < 100 ? 'smooth' : 'auto'
            })
          }
        }
      })
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

$time-picker-line-height: 24px;

.dito-time-picker-popup {
  max-width: 160px;
  margin: $popup-margin;
  list-style: none;
  background: $color-white;
  border: $border-style;
  border-radius: $border-radius;
  box-shadow: $shadow-window;
  overflow: hidden;
}

.dito-time-picker-popup .dito-time-picker-panel {
  float: left;
  border: $border-style;
  border-width: 0 1px 0;
  margin-left: -1px;
  box-sizing: border-box;
  width: calc(100% / 3 + 1px);
  overflow: hidden;

  &:last-child {
    border-right: 0;
  }

  ul {
    // The offset parent of the options, see `scrollToSelectedOptions()`.
    position: relative;
    overflow-x: hidden;
    overflow-y: auto;
    list-style: none;
    width: 100%;
    margin: 0;
    // Hide scrollbar:
    box-sizing: content-box;
    padding: 0 17px 0 0;
    height: 7 * $time-picker-line-height;

    & > li {
      box-sizing: content-box;
      background: $color-white;
      width: 100%;
      height: $time-picker-line-height;
      line-height: $time-picker-line-height;
      text-align: center;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      @include user-select(none);

      &:first-child {
        margin-top: 3 * $time-picker-line-height;
      }

      &:last-child {
        margin-bottom: 3 * $time-picker-line-height;
      }

      &:hover {
        background: $color-highlight;
      }

      &.selected,
      &.selected:hover {
        color: $color-text-inverted;
        background: $color-active;
      }
    }
  }
}
</style>
