// Derived from ATUI, and further extended: https://aliqin.github.io/atui/

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
              ) {{ dateToString(currentValue, { year: 1 }) }}
              a.dito-calendar-select-month(
                @click="setMode('month')"
              ) {{ dateToString(currentValue, { month: 1 }) }}
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
                @click="selectDate(date.date, date.state, true)"
              ) {{ date.text }}
          .dito-calendar-footer
            a.dito-calendar-select-today(
              role="button"
              @click="selectDate(new Date())"
              :title="dateToString(new Date(), { year: 1, month: 1, day: 1 })"
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
              ) {{ dateToString(currentValue, { year: 1 }) }}
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

<style lang="sass">
  .dito-calendar
    min-width: 240px
    box-sizing: border-box

  .dito-calendar-popup
    border: $border-style
    border-radius: $border-radius
    background: $color-white
    box-shadow: $shadow-window
    z-index: 1000

  .dito-calendar-body
    padding: 0 0.5em
    span
      display: inline-block
      width: calc(100% / 7)
      height: $input-height
      line-height: calc(#{$input-height} - 2px)
      box-sizing: border-box
      border-radius: $border-radius
      border: $border-width solid transparent
      text-align: center
    .dito-calendar-item-today
      border: $border-width solid $color-active
      color: $color-active
    .dito-calendar-item-active
      &,
      &:hover
        background: $color-active
        color: white
    .dito-calendar-item-disabled
      background: white
      cursor: default
    .dito-calendar-item-disabled,
    .dito-calendar-item-gray
      color: #999

  .dito-calendar-months,
  .dito-calendar-years
    span
      width: calc(100% / 4)
      margin: 0.5em 0

  .dito-calendar-years span
    width: calc(100% / 5)

  .dito-calendar a,
  .dito-calendar-dates span,
  .dito-calendar-months span,
  .dito-calendar-years span
    +user-select(none)
    white-space: nowrap
    cursor: pointer

  .dito-calendar-header span
    cursor: default
    a
      padding: 0 0.2em

  .dito-calendar-dates span:hover,
  .dito-calendar-months span:hover,
  .dito-calendar-years span:hover,
  .dito-calendar:not(:hover) .dito-calendar-item-current
    background: $color-highlight

  .dito-calendar-weekdays span
    font-weight: bold
    +user-select(none)

  .dito-calendar-header,
  .dito-calendar-footer
    @extend %input-height
    position: relative
    text-align: center

  .dito-calendar-footer
    border-top: $border-style

  .dito-calendar-header
    font-weight: bold
    border-bottom: $border-style
    display: flex
    > span
      margin: auto
      padding: 0 0.5em
    a
      font-weight: bold
      &:hover
        color: $color-active

  .dito-calendar-step-prev,
  .dito-calendar-step-next
    position: relative
    width: 5%
    min-width: 2em
    max-width: 3em
    &::after
      position: absolute
      left: 0
      right: 0
      font-size: 1.25em
  .dito-calendar-step-prev
    &::after
      content: '‹'
    &.dito-calendar-step-year::after
      content: '«'
  .dito-calendar-step-next
    &::after
      content: '›'
    &.dito-calendar-step-year::after
      content: '»'

  .dito-calendar-select-today
    &::after
      content: 'Now'
</style>

<script>
import { copyDate } from '../utils/index.js'

export default {
  props: {
    value: { type: Date, default: null },
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
      currentValue:
        this.value ||
        // If no value is provided, use current date but clear time fields:
        copyDate(new Date(), { hour: 0, minute: 0, second: 0 }),
      currentMode: this.mode
    }
  },

  watch: {
    currentValue: 'updateDateRange',
    disabledDate: 'updateDateRange',

    value(newVal, oldVal) {
      if (+newVal !== +oldVal) {
        this.currentValue = newVal || new Date()
      }
    },

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
        'dito-calendar-item-active':
          this.value && month === this.value.getMonth() &&
          this.currentValue.getFullYear() === this.value.getFullYear(),
        'dito-calendar-item-current':
          month === this.currentValue.getMonth()
      }
    },

    getYearClass(year) {
      return {
        'dito-calendar-item-active':
          this.value && year === this.value.getFullYear(),
        'dito-calendar-item-current':
          year === this.currentValue.getFullYear()
      }
    },

    setDate(overrides) {
      this.currentValue = copyDate(this.currentValue, overrides)
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
          this.getDayCount(year, month),
          this.currentValue.getDate()
        )
      })
    },

    stepYear(step) {
      this.setDate({
        year: this.currentValue.getFullYear() + step
      })
    },

    selectDate(date, state, copy = false) {
      if (state !== 'disabled') {
        if (copy) {
          this.setDate({
            year: date.getFullYear(),
            month: date.getMonth(),
            day: date.getDate()
          })
        } else {
          this.currentValue = date
        }
        this.$emit('input', this.currentValue)
      }
    },

    selectMonth(month) {
      this.setMode('day')
      this.setDate({ month })
    },

    selectYear(year) {
      this.setMode('month')
      this.setDate({ year })
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

    dateToString(date, { year, month, day }) {
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

    getDayCount(year, month) {
      const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
      // Handle leap year:
      return month === 1 && (!(year % 400) || !(year % 4) && (year % 100))
        ? 29
        : daysInMonth[month]
    },

    getFirstYearOfDecade(year) {
      const yearStr = year.toString()
      return +`${yearStr.slice(0, -1)}0`
    },

    navigate({ hor, ver, enter }) {
      const { currentMode, currentValue } = this
      if (hor || ver) {
        switch (currentMode) {
        case 'day':
          this.setDate({
            day: currentValue.getDate() + hor + ver * 7
          })
          break
        case 'month':
          this.setDate({
            month: currentValue.getMonth() + hor + ver * 6
          })
          break
        case 'year':
          this.setDate({
            year: currentValue.getFullYear() + hor + ver * 5
          })
          break
        }
        return true
      } else if (enter) {
        switch (currentMode) {
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
      const dayCount = this.getDayCount(year, month)
      if (firstDayWeek > 1) {
        const prevMonth = this.getYearMonth(year, month - 1)
        const prevMonthDayCount = this.getDayCount(
          prevMonth.year,
          prevMonth.month
        )
        for (let i = 1; i < firstDayWeek; i++) {
          const day = prevMonthDayCount - firstDayWeek + i + 1
          const date = new Date(prevMonth.year, prevMonth.month, day)
          this.dateRange.push({
            text: day,
            date,
            state: this.disabledDate(date) ? 'disabled' : 'gray'
          })
        }
      }

      const today = new Date()
      for (let i = 1; i <= dayCount; i++) {
        const date = new Date(year, month, i)
        const isDay = date => date &&
          date.getDate() === i &&
          date.getFullYear() === year &&
          date.getMonth() === month
        const state = isDay(this.value) ? 'active'
          : isDay(today) ? 'today'
          : this.disabledDate(date) ? 'disabled'
          : isDay(currentValue) ? 'current'
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
