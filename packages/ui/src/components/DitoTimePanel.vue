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

const hours = [...Array(24).keys()]
const minutes = [...Array(60).keys()]

// The panel of `DitoTimePicker` and `DitoDateTimePicker`, with a list of the
// values for each of the hour, minute and second. The picker's input navigates
// it through `handleKey()`.
export default {
  emits: ['update:modelValue', 'select'],

  props: {
    modelValue: { type: Date, default: null }
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

    columns() {
      const { currentDate } = this
      return [
        {
          name: 'hour',
          label: 'Hour',
          value: currentDate.getHours(),
          values: hours
        },
        {
          name: 'minute',
          label: 'Minute',
          value: currentDate.getMinutes(),
          values: minutes
        },
        {
          name: 'second',
          label: 'Second',
          value: currentDate.getSeconds(),
          values: minutes
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
      this.optionElements[name][value] = element
    },

    setTime(overrides) {
      const time = { millisecond: 0 }
      for (const { name, value } of this.columns) {
        time[name] = overrides[name] ?? value
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
        // Wrap around at the ends:
        const { length } = column.values
        this.setTime({ [column.name]: (column.value + step + length) % length })
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
