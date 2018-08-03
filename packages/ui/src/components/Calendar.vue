// Derived from ATUI, and further extended: https://aliqin.github.io/atui/

<template lang="pug">
  .dito-calendar(
    v-show="show"
  )
    .dito-calendar-popup
      .dito-calendar-inner
        template(
          v-if="currMode === 'day'"
        )
          .dito-calendar-header
            a.dito-calendar-button-year.dito-calendar-button-prev(
              @click="stepYear(-1)"
            )
            a.dito-calendar-button-prev(
              @click="stepMonth(-1)"
            )
            span
              a(
                @click="currMode = 'year'"
              ) {{ dateToString(date, { year: 1 }) }}
              a(
                @click="currMode = 'month'"
              ) {{ dateToString(date, { month: 1 }) }}
            a.dito-calendar-button-next(
              @click="stepMonth(1)"
            )
            a.dito-calendar-button-year.dito-calendar-button-next(
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
            a.dito-calendar-button-today(
              role="button"
              @click="selectDate(new Date())"
              :title="dateToString(new Date(), { year: 1, month: 1, day: 1 })"
            )
        template(
          v-if="currMode === 'month'"
        )
          .dito-calendar-header
            a.dito-calendar-button-prev(
              @click="stepYear(-1)"
            )
            span
              a(
                @click="currMode ='year'"
              ) {{ dateToString(date, { year: 1 }) }}
            a.dito-calendar-button-next(
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
          v-if="currMode === 'year'"
        )
          .dito-calendar-header
            a.dito-calendar-button-prev(
              @click="stepDecade(-1)"
            )
            span {{ decadeToString(date) }}
            a.dito-calendar-button-next(
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
    // box-shadow: 0 6px 12px rgba(0, 0, 0, 0.175)
    z-index: 1000

  .dito-calendar-body
    padding: 0 0.5em
    span
      display: inline-block
      width: (100% / 7)
      line-height: calc(2em - 2px)
      height: 2em
      box-sizing: border-box
      border-radius: $border-radius
      border: 1px solid transparent
      text-align: center
    .dito-calendar-item-today
      border: 1px solid $color-active
      color: $color-active
    .dito-calendar-item-active
      &,
      &:hover
        background: $color-active
        color: white
    .dito-calendar-item-disabled
      background: white
      cursor: not-allowed
    .dito-calendar-item-disabled,
    .dito-calendar-item-gray
      color: #999

  .dito-calendar-months,
  .dito-calendar-years
    span
      width: (100% / 4)
      margin: 0.5em 0

  .dito-calendar-years span
    width: (100% / 5)

  .dito-calendar a,
  .dito-calendar-dates span,
  .dito-calendar-months span,
  .dito-calendar-years span,
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
    position: relative
    height: 2em
    line-height: 2em
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

  .dito-calendar-button-prev,
  .dito-calendar-button-next
    position: relative
    width: 5%
    min-width: 2em
    max-width: 3em
    &::after
      position: absolute
      left: 0
      right: 0
      font-size: 1.25em

  .dito-calendar-button-today
    &::after
      content: 'Now'

  .dito-calendar-button-prev
    &::after
      content: '‹'
    &.dito-calendar-button-year::after
      content: '«'

  .dito-calendar-button-next
    &::after
      content: '›'
    &.dito-calendar-button-year::after
      content: '»'
</style>

<script>
import { copyDate } from '../utils'

export default {
  props: {
    value: {
      type: Date,
      default: null
    },
    locale: {
      type: String,
      default: 'en-US'
    },
    format: {
      type: String,
      default: 'yyyy-MM-dd'
    },
    disabledDate: {
      type: Function,
      default: () => false
    },
    show: {
      type: Boolean,
      default: true
    },
    mode: {
      type: String,
      default: 'day'
    }
  },

  data() {
    const weekdayNames = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(0, 0, i)
      weekdayNames.push({
        long: this.toLocaleString(date, { weekday: 'long' }),
        short: this.toLocaleString(date, { weekday: 'short' })
      })
    }
    const monthNames = []
    for (let i = 1; i <= 12; i++) {
      const date = new Date(0, i, 0)
      monthNames.push({
        long: this.toLocaleString(date, { month: 'long' }),
        short: this.toLocaleString(date, { month: 'short' })
      })
    }
    return {
      weekdayNames,
      monthNames,
      dateRange: [],
      yearRange: [],
      date: new Date(),
      currMode: this.mode
    }
  },

  watch: {
    date: 'updateDateRange',
    disabledDate: 'updateDateRange',

    value(value) {
      this.date = value || new Date()
    },

    mode(mode) {
      this.currMode = mode
    }
  },

  mounted() {
    if (this.value) {
      this.date = this.value
    } else {
      // clear time fields, since `new Date()` is being used
      this.setDate({ hours: 0, minutes: 0, seconds: 0 })
    }
  },

  methods: {
    close() {
      this.currMode = null
    },

    getMonthClass(month) {
      return {
        'dito-calendar-item-active':
          this.value && month === this.value.getMonth() &&
          this.date.getFullYear() === this.value.getFullYear(),
        'dito-calendar-item-current':
          month === this.date.getMonth()
      }
    },

    getYearClass(year) {
      return {
        'dito-calendar-item-active':
          this.value && year === this.value.getFullYear(),
        'dito-calendar-item-current':
          year === this.date.getFullYear()
      }
    },

    setDate(overrides) {
      this.date = copyDate(this.date, overrides)
    },

    stepDecade(step) {
      this.setDate({ year: this.date.getFullYear() + step * 10 })
    },

    stepMonth(step) {
      const { year, month } = this.getYearMonth(
        this.date.getFullYear(),
        this.date.getMonth() + step
      )
      this.setDate({
        month,
        day: Math.min(this.getDayCount(year, month), this.date.getDate())
      })
    },

    stepYear(step) {
      this.setDate({ year: this.date.getFullYear() + step })
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
          this.date = date
        }
        this.$emit('input', this.date)
      }
    },

    selectMonth(month) {
      this.currMode = 'day'
      this.setDate({ month })
    },

    selectYear(year) {
      this.currMode = 'month'
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

    toLocaleString(date, options) {
      return date.toLocaleString(this.locale, options)
    },

    dateToString(date, { year, month, day }) {
      return this.toLocaleString(date, {
        year: year && 'numeric',
        month: month && 'long',
        day: day && 'numeric'
      })
    },

    decadeToString(date) {
      const year = this.getFirstYearOfDecade(date.getFullYear())
      return `${year} – ${year + 9}`
    },

    stringify(date, format = this.format) {
      if (date) {
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const day = date.getDate()
        const monthName = this.monthNames[date.getMonth()]
        return format
          .replace(/yyyy/g, year)
          .replace(/MMMM/g, monthName.long)
          .replace(/MMM/g, monthName.short)
          .replace(/MM/g, ('0' + month).slice(-2))
          .replace(/dd/g, ('0' + day).slice(-2))
          .replace(/yy/g, year)
          .replace(/M(?!a)/g, month)
          .replace(/d/g, day)
      }
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
      return +`${yearStr.substring(0, yearStr.length - 1)}0`
    },

    navigate({ hor, ver, enter }) {
      if (hor || ver) {
        switch (this.currMode) {
        case 'day':
          this.setDate({ day: this.date.getDate() + hor + ver * 7 })
          break
        case 'month':
          this.setDate({ month: this.date.getMonth() + hor + ver * 6 })
          break
        case 'year':
          this.setDate({ year: this.date.getFullYear() + hor + ver * 5 })
          break
        }
        return true
      } else if (enter) {
        switch (this.currMode) {
        case 'day':
          this.selectDate(this.date)
          break
        case 'month':
          this.currMode = 'day'
          break
        case 'year':
          this.currMode = 'month'
          break
        }
        return true
      }
    },

    updateDateRange() {
      this.dateRange = []
      this.yearRange = []

      const today = new Date()
      const year = this.date.getFullYear()
      const month = this.date.getMonth()
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

      for (let i = 1; i <= dayCount; i++) {
        const date = new Date(year, month, i)
        const isDay = date => date &&
          date.getDate() === i &&
          date.getFullYear() === year &&
          date.getMonth() === month
        const state = isDay(this.value) ? 'active'
          : isDay(today) ? 'today'
          : this.disabledDate(date) ? 'disabled'
          : isDay(this.date) ? 'current'
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
</script>
