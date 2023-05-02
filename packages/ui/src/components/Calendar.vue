<!-- Derived from ATUI, and further extended: https://aliqin.github.io/atui/ -->
<template lang="pug">
.dito-calendar
  .dito-calendar-popup
    .dito-calendar-inner
      template(
        v-if="currentMode === 'day'"
      )
        .dito-calendar-header
          a.dito-calendar-step-prev.dito-calendar-step-year(
            @click="stepYear(-1)"
          )
          a.dito-calendar-step-prev.dito-calendar-step-month(
            @click="stepMonth(-1)"
          )
          span
            a.dito-calendar-select-year(
              @click="setMode('year')"
            ) {{ dateToString(currentValue, { year: true }) }}
            a.dito-calendar-select-month(
              @click="setMode('month')"
            ) {{ dateToString(currentValue, { month: true }) }}
          a.dito-calendar-step-next.dito-calendar-step-month(
            @click="stepMonth(1)"
          )
          a.dito-calendar-step-next.dito-calendar-step-year(
            @click="stepYear(1)"
          )
        .dito-calendar-body
          .dito-calendar-weekdays
            span(
              v-for="weekday in weekdayNames"
            ) {{ weekday.short }}
          .dito-calendar-dates
            span(
              v-for="date in dateRange"
              :class="date.state && `dito-calendar-item-${date.state}`"
              @click="date.state !== 'disabled' && selectDate(date.date)"
            ) {{ date.text }}
        .dito-calendar-footer
          a.dito-calendar-select-now(
            role="button"
            :title="dateToString(new Date())"
            @click="selectDate(new Date())"
          )
      template(
        v-else-if="currentMode === 'month'"
      )
        .dito-calendar-header
          a.dito-calendar-step-prev(
            @click="stepYear(-1)"
          )
          span
            a.dito-calendar-select-year(
              @click="setMode('year')"
            ) {{ dateToString(currentValue, { year: true }) }}
          a.dito-calendar-step-next(
            @click="stepYear(1)"
          )
        .dito-calendar-body
          .dito-calendar-months
            span(
              v-for="(month, index) in monthNames"
              :class="getMonthClass(index)"
              @click="selectMonth(index)"
            ) {{ month.short }}
      template(
        v-else-if="currentMode === 'year'"
      )
        .dito-calendar-header
          a.dito-calendar-step-prev(
            @click="stepDecade(-1)"
          )
          span {{ decadeToString(currentValue) }}
          a.dito-calendar-step-next(
            @click="stepDecade(1)"
          )
        .dito-calendar-body
          .dito-calendar-years
            span(
              v-for="year in yearRange"
              :class="getYearClass(year)"
              @click="selectYear(year)"
            ) {{ year }}
</template>

<script>
import { describeDate, alterDate } from '../utils/date.js'

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
      dateRange: [],
      yearRange: [],
      currentValue: (
        this.modelValue ||
        // If no value is provided, use current date but clear time fields:
        alterDate(new Date(), { hour: 0, minute: 0, second: 0, millisecond: 0 })
      ),
      currentMode: this.mode
    }
  },

  watch: {
    modelValue(to, from) {
      if (+to !== +from) {
        this.currentValue = to || new Date()
        this.updateDateRange()
      }
    },

    currentValue(to, from) {
      if (+to !== +from) {
        this.updateDateRange()
      }
    },

    disabledDate: 'updateDateRange',

    mode(mode) {
      this.currentMode = mode
    }
  },

  mounted() {
    this.updateDateRange()
  },

  methods: {
    getMonthClass(month) {
      return {
        'dito-calendar-item-active': (
          this.modelValue &&
          month === this.modelValue.getMonth() &&
          this.currentValue.getFullYear() === this.modelValue.getFullYear()
        ),
        'dito-calendar-item-current': month === this.currentValue.getMonth()
      }
    },

    getYearClass(year) {
      return {
        'dito-calendar-item-active': (
          this.modelValue && year === this.modelValue.getFullYear()
        ),
        'dito-calendar-item-current': year === this.currentValue.getFullYear()
      }
    },

    setDate(overrides, update = false) {
      this.currentValue = alterDate(this.currentValue, overrides)
      if (update) {
        this.$emit('update:modelValue', this.currentValue)
      }
    },

    stepDecade(step) {
      this.setDate({
        year: this.currentValue.getFullYear() + step * 10
      })
    },

    setMode(mode) {
      this.currentMode = mode
    },

    stepMonth(step) {
      const { currentValue } = this
      const { year, month } = this.getYearMonth(
        currentValue.getFullYear(),
        currentValue.getMonth() + step
      )
      this.setDate({
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
      this.setDate(describeDate(date), true)
      this.$emit('select')
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

    navigate({ step, enter, mode = this.currentMode, update = false }) {
      const { currentValue } = this
      if (step) {
        switch (mode) {
          case 'day':
            this.setDate({ day: currentValue.getDate() + step }, update)
            break
          case 'month':
            this.setDate({ month: currentValue.getMonth() + step }, update)
            break
          case 'year':
            this.setDate({ year: currentValue.getFullYear() + step }, update)
            break
        }
        return true
      } else if (enter) {
        switch (this.currentMode) {
          case 'day':
            this.selectDate(currentValue)
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
    },

    updateDateRange() {
      this.dateRange = []
      this.yearRange = []

      const { currentValue } = this
      const year = currentValue.getFullYear()
      const month = currentValue.getMonth()
      const startYear = this.getFirstYearOfDecade(year)
      for (let i = 0; i < 10; i++) {
        this.yearRange.push(startYear + i)
      }
      const currMonthFirstDay = new Date(year, month, 1)
      let firstDayWeek = currMonthFirstDay.getDay() + 1
      if (firstDayWeek === 0) {
        firstDayWeek = 7
      }
      const numDays = this.getDaysInMonth(year, month)
      if (firstDayWeek > 1) {
        const prevMonth = this.getYearMonth(year, month - 1)
        const prevMonthNumDays = this.getDaysInMonth(
          prevMonth.year,
          prevMonth.month
        )
        for (let i = 1; i < firstDayWeek; i++) {
          const day = prevMonthNumDays - firstDayWeek + i + 1
          const date = new Date(prevMonth.year, prevMonth.month, day)
          this.dateRange.push({
            text: day,
            date,
            state: this.disabledDate(date) ? 'disabled' : 'gray'
          })
        }
      }

      const now = new Date()
      for (let i = 1; i <= numDays; i++) {
        const date = new Date(year, month, i)
        const isDay = date => (
          date &&
          date.getDate() === i &&
          date.getFullYear() === year &&
          date.getMonth() === month
        )
        const state = isDay(this.modelValue)
          ? 'active'
          : isDay(now)
            ? 'today'
            : this.disabledDate(date)
              ? 'disabled'
              : isDay(currentValue)
                ? 'current'
                : null
        this.dateRange.push({
          text: i,
          date,
          state
        })
      }

      const nextMonthNeed = 42 - this.dateRange.length
      if (nextMonthNeed > 0) {
        const nextMonth = this.getYearMonth(year, month + 1)
        for (let i = 1; i <= nextMonthNeed; i++) {
          const date = new Date(nextMonth.year, nextMonth.month, i)
          const state = this.disabledDate(date) ? 'disabled' : 'gray'
          this.dateRange.push({
            text: i,
            date,
            state
          })
        }
      }
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
}

.dito-calendar-popup {
  border: $border-style;
  border-radius: $border-radius;
  background: $color-white;
  box-shadow: $shadow-window;
  z-index: 1000;
}

.dito-calendar-body {
  padding: 0 0.5em;

  span {
    display: inline-block;
    width: calc(100% / 7);
    height: $input-height;
    line-height: calc(#{$input-height} - 2px);
    box-sizing: border-box;
    border-radius: $border-radius;
    border: $border-width solid transparent;
    text-align: center;
  }

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

.dito-calendar-months,
.dito-calendar-years {
  span {
    width: calc(100% / 4);
    margin: 0.5em 0;
  }
}

.dito-calendar-years span {
  width: calc(100% / 5);
}

.dito-calendar a,
.dito-calendar-dates span,
.dito-calendar-months span,
.dito-calendar-years span {
  @include user-select(none);

  white-space: nowrap;
  cursor: pointer;
}

.dito-calendar-header span {
  cursor: default;

  a {
    padding: 0 0.2em;
  }
}

.dito-calendar-dates span:hover,
.dito-calendar-months span:hover,
.dito-calendar-years span:hover,
.dito-calendar:not(:hover) .dito-calendar-item-current {
  background: $color-highlight;
}

.dito-calendar-weekdays span {
  font-weight: bold;
  @include user-select(none);
}

.dito-calendar-header,
.dito-calendar-footer {
  @extend %input-height;

  position: relative;
  text-align: center;
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
  }

  a {
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
    left: 0;
    right: 0;
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
