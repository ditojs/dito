<!-- Derived from ATUI, and further extended: https://aliqin.github.io/atui/ -->
<template lang="pug">
.dito-calendar(
  role="dialog"
  aria-label="Choose date"
)
  .dito-calendar-popup
    .dito-calendar-inner
      template(
        v-if="currentMode === 'day'"
      )
        .dito-calendar-header
          button.dito-calendar-step-prev.dito-calendar-step-year(
            type="button"
            aria-label="Previous year"
            @click="stepYear(-1)"
          )
          button.dito-calendar-step-prev.dito-calendar-step-month(
            type="button"
            aria-label="Previous month"
            @click="stepMonth(-1)"
          )
          span
            button.dito-calendar-select-year(
              type="button"
              aria-label="Switch to year selection"
              @click="setMode('year')"
            ) {{ dateToString(currentValue, { year: true }) }}
            button.dito-calendar-select-month(
              type="button"
              aria-label="Switch to month selection"
              @click="setMode('month')"
            ) {{ dateToString(currentValue, { month: true }) }}
          button.dito-calendar-step-next.dito-calendar-step-month(
            type="button"
            aria-label="Next month"
            @click="stepMonth(1)"
          )
          button.dito-calendar-step-next.dito-calendar-step-year(
            type="button"
            aria-label="Next year"
            @click="stepYear(1)"
          )
        .dito-calendar-body
          .dito-calendar-dates(
            role="grid"
            :aria-label="monthLabel"
            @keydown="onDatesKeyDown"
          )
            .dito-calendar-weekdays(role="row")
              span(
                v-for="weekday in weekdayNames"
                role="columnheader"
                :aria-label="weekday.long"
              ) {{ weekday.short }}
            .dito-calendar__week(
              v-for="week in weeks"
              :key="+week[0].date"
              role="row"
            )
              button.dito-calendar__item(
                v-for="item in week"
                :key="+item.date"
                :ref="item.isCursor ? 'cursorItem' : undefined"
                type="button"
                role="gridcell"
                :tabindex="item.isCursor ? 0 : -1"
                :class="item.state && `dito-calendar-item-${item.state}`"
                :aria-label="dateToString(item.date)"
                :aria-selected="item.state === 'active' ? 'true' : 'false'"
                :aria-disabled="item.isDisabled ? 'true' : null"
                @click="selectDay(item.date)"
              ) {{ item.date.getDate() }}
        .dito-calendar-footer
          button.dito-calendar-select-now(
            type="button"
            :aria-label="`Select today (${dateToString(new Date())})`"
            :title="dateToString(new Date())"
            @click="selectDate(new Date())"
          )
      template(
        v-else-if="currentMode === 'month'"
      )
        .dito-calendar-header
          button.dito-calendar-step-prev(
            type="button"
            aria-label="Previous year"
            @click="stepYear(-1)"
          )
          span
            button.dito-calendar-select-year(
              type="button"
              aria-label="Switch to year selection"
              @click="setMode('year')"
            ) {{ dateToString(currentValue, { year: true }) }}
          button.dito-calendar-step-next(
            type="button"
            aria-label="Next year"
            @click="stepYear(1)"
          )
        .dito-calendar-body
          .dito-calendar-months
            button.dito-calendar__item(
              v-for="(month, index) in monthNames"
              :ref="isCurrentMonth(index) ? 'cursorItem' : undefined"
              type="button"
              :class="getMonthClass(index)"
              :aria-label="month.long"
              :aria-pressed="isActiveMonth(index) ? 'true' : 'false'"
              @click="selectMonth(index)"
            ) {{ month.short }}
      template(
        v-else-if="currentMode === 'year'"
      )
        .dito-calendar-header
          button.dito-calendar-step-prev(
            type="button"
            aria-label="Previous decade"
            @click="stepDecade(-1)"
          )
          span {{ decadeToString(currentValue) }}
          button.dito-calendar-step-next(
            type="button"
            aria-label="Next decade"
            @click="stepDecade(1)"
          )
        .dito-calendar-body
          .dito-calendar-years
            button.dito-calendar__item(
              v-for="year in yearRange"
              :ref="isCurrentYear(year) ? 'cursorItem' : undefined"
              type="button"
              :class="getYearClass(year)"
              :aria-label="String(year)"
              :aria-pressed="isActiveYear(year) ? 'true' : 'false'"
              @click="selectYear(year)"
            ) {{ year }}
</template>

<script>
import { asArray } from '@ditojs/utils'
import { describeDate, alterDate } from '../utils/date.js'
import { getKeyNavigation } from '../utils/event.js'

// The most dates that `navigate()` skips while looking for one that isn't
// disabled, a year's worth of days.
const maxSkippedDateCount = 366

export default {
  emits: ['update:modelValue', 'select'],

  props: {
    modelValue: { type: Date, default: null },
    locale: { type: String, default: 'en-US' },
    disabledDate: { type: Function, default: () => false },
    mode: { type: String, default: 'day' }
  },

  data() {
    const { weekdayNames, monthNames } = getLocaleNames(this.locale)
    return {
      weekdayNames,
      monthNames,
      currentValue: (
        this.modelValue ||
        // If no value is provided, use current date but clear time fields:
        alterDate(new Date(), { hour: 0, minute: 0, second: 0, millisecond: 0 })
      ),
      currentMode: this.mode
    }
  },

  computed: {
    // The 42 days of the six weeks shown for the month of `currentValue`.
    dateRange() {
      const { currentValue } = this
      const year = currentValue.getFullYear()
      const month = currentValue.getMonth()
      // The weeks start on Sunday:
      const firstDate = new Date(
        year,
        month,
        1 - new Date(year, month).getDay()
      )
      const isSameDay = (date, other) => (
        !!other &&
        date.getDate() === other.getDate() &&
        date.getMonth() === other.getMonth() &&
        date.getFullYear() === other.getFullYear()
      )
      const now = new Date()
      const items = []
      for (let i = 0; i < 42; i++) {
        const date = new Date(
          firstDate.getFullYear(),
          firstDate.getMonth(),
          firstDate.getDate() + i
        )
        const isDisabled = this.disabledDate(date)
        const state =
          date.getMonth() !== month
            ? isDisabled
              ? 'disabled'
              : 'gray'
            : isSameDay(date, this.modelValue)
              ? 'active'
              : isSameDay(date, now)
                ? 'today'
                : isDisabled
                  ? 'disabled'
                  : isSameDay(date, currentValue)
                    ? 'current'
                    : null
        items.push({
          date,
          state,
          isDisabled,
          isCursor: isSameDay(date, currentValue)
        })
      }
      return items
    },

    monthLabel() {
      return this.dateToString(this.currentValue, { year: true, month: true })
    },

    weeks() {
      const weeks = []
      for (let i = 0; i < this.dateRange.length; i += 7) {
        weeks.push(this.dateRange.slice(i, i + 7))
      }
      return weeks
    },

    yearRange() {
      const startYear = this.getFirstYearOfDecade(
        this.currentValue.getFullYear()
      )
      return Array.from({ length: 10 }, (_, index) => startYear + index)
    }
  },

  watch: {
    modelValue(to, from) {
      if (+to !== +from) {
        this.currentValue = to || new Date()
      }
    },

    mode(mode) {
      this.currentMode = mode
    }
  },

  methods: {
    isActiveMonth(month) {
      return (
        !!this.modelValue &&
        month === this.modelValue.getMonth() &&
        this.currentValue.getFullYear() === this.modelValue.getFullYear()
      )
    },

    isCurrentMonth(month) {
      return month === this.currentValue.getMonth()
    },

    isActiveYear(year) {
      return !!this.modelValue && year === this.modelValue.getFullYear()
    },

    isCurrentYear(year) {
      return year === this.currentValue.getFullYear()
    },

    getMonthClass(month) {
      return {
        'dito-calendar-item-active': this.isActiveMonth(month),
        'dito-calendar-item-current': this.isCurrentMonth(month)
      }
    },

    getYearClass(year) {
      return {
        'dito-calendar-item-active': this.isActiveYear(year),
        'dito-calendar-item-current': this.isCurrentYear(year)
      }
    },

    // Moves the cursor of the calendar to `date`, and also selects it if
    // `update` is true.
    setDate(overrides, update = false) {
      const date = alterDate(this.currentValue, overrides)
      this.currentValue = date
      if (update) {
        this.commitDate(date)
      }
    },

    // All changes of the value go through here, so disabled dates are never
    // selected. Returns whether the date was selected.
    commitDate(date) {
      if (this.disabledDate(date)) {
        return false
      }
      this.currentValue = date
      this.$emit('update:modelValue', date)
      return true
    },

    stepDecade(step) {
      this.setDate({
        year: this.currentValue.getFullYear() + step * 10
      })
    },

    setMode(mode) {
      this.currentMode = mode
      this.focusCursorItemIfFocused()
    },

    stepMonth(step) {
      const { currentValue } = this
      const { year, month } = this.getYearMonth(
        currentValue.getFullYear(),
        currentValue.getMonth() + step
      )
      this.setDate({
        year,
        month,
        day: Math.min(
          this.getDaysInMonth(year, month),
          this.currentValue.getDate()
        )
      })
    },

    stepYear(step) {
      this.setDate({
        year: this.currentValue.getFullYear() + step
      })
    },

    selectDate(date) {
      if (this.commitDate(date)) {
        this.$emit('select')
      }
    },

    // Selects the day of `date`, keeping the time of the current value.
    selectDay(date) {
      this.selectDate(
        alterDate(this.currentValue, {
          year: date.getFullYear(),
          month: date.getMonth(),
          day: date.getDate()
        })
      )
    },

    selectMonth(month) {
      this.setMode('day')
      // Set day to 1 to avoid selecting a date that is not available in the
      // new month, e.g. Feb 31 -> Mar 3.
      this.setDate({ month, day: 1 }, true)
    },

    selectYear(year) {
      this.setMode('month')
      this.setDate({ year }, true)
    },

    getYearMonth(year, month) {
      if (month > 11) {
        year++
        month = 0
      } else if (month < 0) {
        year--
        month = 11
      }
      return { year, month }
    },

    dateToString(
      date,
      { year, month, day } = { year: true, month: true, day: true }
    ) {
      return date.toLocaleString(this.locale, {
        year: year && 'numeric',
        month: month && 'long',
        day: day && 'numeric'
      })
    },

    decadeToString(date) {
      const year = this.getFirstYearOfDecade(date.getFullYear())
      return `${year} – ${year + 9}`
    },

    getDaysInMonth(year, month) {
      return new Date(year, month + 1, 0).getDate()
    },

    getFirstYearOfDecade(year) {
      const yearStr = year.toString()
      return +`${yearStr.slice(0, -1)}0`
    },

    // Steps the date part `mode` of the cursor by `step`, or confirms the
    // cursor with `enter`. With `update`, the stepped date is also selected,
    // skipping disabled dates. Returns whether anything happened.
    navigate({ step, enter, mode = this.currentMode, update = false }) {
      if (step) {
        if (!['day', 'month', 'year'].includes(mode)) {
          return false
        }
        let date = this.currentValue
        let skippedCount = 0
        do {
          date = alterDate(date, { [mode]: describeDate(date)[mode] + step })
        } while (
          update &&
          this.disabledDate(date) &&
          ++skippedCount < maxSkippedDateCount
        )
        if (update) {
          return this.commitDate(date)
        }
        this.currentValue = date
        return true
      } else if (enter) {
        switch (this.currentMode) {
          case 'day':
            this.selectDate(this.currentValue)
            break
          case 'month':
            this.setMode('day')
            break
          case 'year':
            this.setMode('month')
            break
        }
        return true
      }
      return false
    },

    // Handles a keydown event of a picker's input, with the caret inside the
    // date part `part`, and returns whether it was handled.
    handleKey(event, part) {
      const { ver: step, enter } = getKeyNavigation(event)
      return step
        ? !!part && this.navigate({ step, mode: part.name, update: true })
        : this.navigate({ enter })
    },

    focusCursorItemIfFocused() {
      if (this.$el?.contains(document.activeElement)) {
        // Wait for the items of the current mode to be rendered.
        this.$nextTick(() => asArray(this.$refs.cursorItem)[0]?.focus())
      }
    },

    onDatesKeyDown(event) {
      const { key, shiftKey } = event
      const { currentValue } = this
      const day = currentValue.getDate()
      const dayOffset = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -7,
        ArrowDown: 7
      }[key]
      if (dayOffset) {
        this.setDate({ day: day + dayOffset })
      } else if (key === 'PageUp' || key === 'PageDown') {
        const step = key === 'PageUp' ? -1 : 1
        if (shiftKey) {
          this.stepYear(step)
        } else {
          this.stepMonth(step)
        }
      } else if (key === 'Home') {
        this.setDate({ day: 1 })
      } else if (key === 'End') {
        this.setDate({
          day: this.getDaysInMonth(
            currentValue.getFullYear(),
            currentValue.getMonth()
          )
        })
      } else {
        return
      }
      event.preventDefault()
      this.focusCursorItemIfFocused()
    }
  }
}

const localeNames = {}

// Calling `toLocaleString()` this much appears to be expensive, so cache it:
function getLocaleNames(locale) {
  let names = localeNames[locale]
  if (!names) {
    const weekdayNames = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(0, 0, i)
      weekdayNames.push({
        long: date.toLocaleString(locale, { weekday: 'long' }),
        short: date.toLocaleString(locale, { weekday: 'short' })
      })
    }
    const monthNames = []
    for (let i = 1; i <= 12; i++) {
      const date = new Date(0, i, 0)
      monthNames.push({
        long: date.toLocaleString(locale, { month: 'long' }),
        short: date.toLocaleString(locale, { month: 'short' })
      })
    }
    names = localeNames[locale] = {
      weekdayNames,
      monthNames
    }
  }
  return names
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-calendar {
  min-width: 240px;
  box-sizing: border-box;

  button {
    padding: 0;
    border: 0;
    font: inherit;
    color: inherit;
    background: none;
    white-space: nowrap;
    cursor: pointer;
    @include user-select(none);

    &:focus-visible {
      outline: none;
      box-shadow: $shadow-focus;
    }
  }
}

.dito-calendar-popup {
  border: $border-style;
  border-radius: $border-radius;
  background: $color-white;
  box-shadow: $shadow-window;
  z-index: $z-index-popup;
}

.dito-calendar-body {
  padding: 0 0.5em;

  .dito-calendar-item-today {
    border: $border-width solid $color-active;
    color: $color-active;
  }

  .dito-calendar-item-active {
    &,
    &:hover {
      background: $color-active;
      color: white;
    }
  }

  .dito-calendar-item-disabled {
    background: white;
    cursor: default;
  }

  .dito-calendar-item-disabled,
  .dito-calendar-item-gray {
    color: #999999;
  }
}

.dito-calendar-weekdays,
.dito-calendar__week {
  display: flex;
}

.dito-calendar-weekdays span,
.dito-calendar__item {
  display: inline-block;
  width: calc(100% / 7);
  height: $input-height;
  line-height: calc($input-height - 2 * $border-width);
  box-sizing: border-box;
  border-radius: $border-radius;
  border: $border-width solid transparent;
  text-align: center;
}

.dito-calendar-months,
.dito-calendar-years {
  .dito-calendar__item {
    width: calc(100% / 4);
    margin: 0.5em 0;
  }
}

.dito-calendar-years .dito-calendar__item {
  width: calc(100% / 5);
}

.dito-calendar__item:hover,
.dito-calendar:not(:hover) .dito-calendar-item-current {
  background: $color-highlight;
}

.dito-calendar-weekdays span {
  font-weight: bold;
  @include user-select(none);
}

.dito-calendar-header,
.dito-calendar-footer {
  position: relative;
  text-align: center;
  height: $input-height;
  line-height: $input-height;
}

.dito-calendar-footer {
  border-top: $border-style;
}

.dito-calendar-header {
  font-weight: bold;
  border-bottom: $border-style;
  display: flex;

  > span {
    margin: auto;
    padding: 0 0.5em;
    cursor: default;

    button {
      padding: 0 0.2em;
    }
  }

  button {
    font-weight: bold;

    &:hover {
      color: $color-active;
    }
  }
}

.dito-calendar-step-prev,
.dito-calendar-step-next {
  position: relative;
  width: 5%;
  min-width: 2em;
  max-width: 3em;

  &::after {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25em;
  }
}

.dito-calendar-step-prev {
  &::after {
    content: '‹';
  }

  &.dito-calendar-step-year::after {
    content: '«';
  }
}

.dito-calendar-step-next {
  &::after {
    content: '›';
  }

  &.dito-calendar-step-year::after {
    content: '»';
  }
}

.dito-calendar-select-now {
  &::after {
    content: 'Now';
  }
}
</style>
