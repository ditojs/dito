<template lang="pug">
.dito-date-picker(:class="$attrs.class")
  //- Picking the selected day again keeps it:
  DatePickerRoot(
    v-bind="$props"
    v-model:placeholder="shownDate"
    v-model:open="open"
    preventDeselect
    weekdayFormat="short"
    @update:modelValue="value => $emit('update:modelValue', value ?? null)"
  )
    //- The popup is placed at the field, not at its button:
    DatePickerAnchor(asChild)
      //- The attributes but `class` go to the field, for its accessible name:
      DatePickerField.dito-input(
        v-slot="{ segments }"
        :class="inputClasses"
        v-bind="attributes"
        @mousedown="onMouseDown"
        @focusin="onPartFocus"
        @click="onPartFocus"
      )
        slot(name="prefix")
        .dito-date-segments
          //- Shown instead of the empty parts while the field isn't focused:
          span.dito-date-picker__placeholder(
            v-if="placeholder"
          ) {{ placeholder }}
          DatePickerInput.dito-date-segments__part(
            v-for="item in segments"
            :key="item.part"
            :part="item.part"
          ) {{ item.value }}
        //- The button opens the calendar, also of fields with a time:
        DatePickerTrigger.dito-date-picker__toggle(
          aria-label="Choose date"
          :disabled="disabled || readonly"
          @click="activePanel = 'date'"
        )
          DitoIcon(
            name="calendar"
            :disabled="disabled"
          )
        slot(name="suffix")
    //- Fixed, so that scrolling panels don't clip it, and without a portal, so
    //- that the styles apply:
    DatePickerContent.dito-picker-popup(
      :portal="{ disabled: true }"
      :align="activePanel === 'time' ? 'end' : 'start'"
      :sideOffset="2"
      :collisionBoundary="scrollContainer"
      positionStrategy="fixed"
      @open-auto-focus="keepPartFocused"
      @close-auto-focus="keepPartFocused"
      @interact-outside="onInteractOutside"
    )
      DitoTimePanel(
        v-if="activePanel === 'time'"
        :modelValue="modelValue ?? shownDate"
        :granularity="granularity"
        @update:modelValue="value => $emit('update:modelValue', value)"
        @select="focusPart"
      )
      DatePickerCalendar.dito-calendar(
        v-else
        v-slot="{ weekDays, grid }"
      )
        DatePickerHeader.dito-calendar__header
          DatePickerPrev.dito-calendar__step(
            aria-label="Previous year"
            :prevPage="date => date.subtract({ years: 1 })"
          )
            span.dito-calendar__arrow.dito-calendar__arrow--prev-year
          DatePickerPrev.dito-calendar__step(aria-label="Previous month")
            span.dito-calendar__arrow.dito-calendar__arrow--prev
          //- The month and year that the calendar shows, not the value:
          select.dito-calendar__select(
            aria-label="Month"
            :value="shownDate.month"
            @change="setPlaceholder({ month: +$event.target.value })"
          )
            option(
              v-for="month in months"
              :key="month.value"
              :value="month.value"
            ) {{ month.label }}
          select.dito-calendar__select(
            aria-label="Year"
            :value="shownDate.year"
            @change="setPlaceholder({ year: +$event.target.value })"
          )
            option(
              v-for="year in years"
              :key="year"
              :value="year"
            ) {{ year }}
          DatePickerNext.dito-calendar__step(aria-label="Next month")
            span.dito-calendar__arrow.dito-calendar__arrow--next
          DatePickerNext.dito-calendar__step(
            aria-label="Next year"
            :nextPage="date => date.add({ years: 1 })"
          )
            span.dito-calendar__arrow.dito-calendar__arrow--next-year
        DatePickerGrid.dito-calendar__grid(
          v-for="month in grid"
          :key="month.value.toString()"
        )
          DatePickerGridHead
            DatePickerGridRow
              DatePickerHeadCell.dito-calendar__weekday(
                v-for="day in weekDays"
                :key="day"
              ) {{ day }}
          DatePickerGridBody
            DatePickerGridRow(
              v-for="(week, index) in month.rows"
              :key="index"
            )
              DatePickerCell(
                v-for="date in week"
                :key="date.toString()"
                :date="date"
              )
                //- Picking a day closes the calendar, while edits in the field
                //- keep it open:
                DatePickerCellTrigger.dito-calendar__day(
                  :day="date"
                  :month="month.value"
                  @click="open = false"
                  @keydown.enter.space="open = false"
                )
        .dito-calendar__footer
          DatePickerClose(asChild)
            button.dito-calendar__now(
              type="button"
              @click="selectNow"
            ) {{ granularity === 'day' ? 'Today' : 'Now' }}
</template>

<script>
import {
  getLocalTimeZone,
  now,
  toCalendarDateTime,
  today
} from '@internationalized/date'
import {
  DatePickerAnchor,
  DatePickerCalendar,
  DatePickerCell,
  DatePickerCellTrigger,
  DatePickerClose,
  DatePickerContent,
  DatePickerField,
  DatePickerGrid,
  DatePickerGridBody,
  DatePickerGridHead,
  DatePickerGridRow,
  DatePickerHeadCell,
  DatePickerHeader,
  DatePickerInput,
  DatePickerNext,
  DatePickerPrev,
  DatePickerRoot,
  DatePickerTrigger
} from 'reka-ui'
import DitoIcon from './DitoIcon.vue'
import DitoTimePanel from './DitoTimePanel.vue'
import { getScrollContainer, hasErrors } from '../utils/element.js'

// A date field with a calendar in a popup, built on reka-ui's `DatePicker`,
// with dates of `@internationalized/date` as values. While a part of the time
// is focused, the popup shows the lists of `DitoTimePanel` instead.
export default {
  components: {
    DatePickerAnchor,
    DatePickerCalendar,
    DatePickerCell,
    DatePickerCellTrigger,
    DatePickerClose,
    DatePickerContent,
    DatePickerField,
    DatePickerGrid,
    DatePickerGridBody,
    DatePickerGridHead,
    DatePickerGridRow,
    DatePickerHeadCell,
    DatePickerHeader,
    DatePickerInput,
    DatePickerNext,
    DatePickerPrev,
    DatePickerRoot,
    DatePickerTrigger,
    DitoIcon,
    DitoTimePanel
  },
  inheritAttrs: false,
  emits: ['update:modelValue', 'update:open'],

  // The props of `DatePickerRoot` that the picker reads or passes on. With a
  // `granularity` finer than `day`, the field also edits the time:
  props: {
    modelValue: { type: Object, default: null },
    // On reka-ui's hidden input, which focuses the field for its label:
    id: { type: String, default: undefined },
    granularity: { type: String, default: 'day' },
    hourCycle: { type: Number, default: undefined },
    locale: { type: String, default: 'en-US' },
    minValue: { type: Object, default: undefined },
    maxValue: { type: Object, default: undefined },
    disabled: { type: Boolean },
    readonly: { type: Boolean },
    placeholder: { type: String, default: null }
  },

  data() {
    return {
      // The month that the calendar shows, which the header's lists change.
      // reka-ui calls it the placeholder:
      shownDate: this.modelValue ?? getToday(this.granularity),
      open: false,
      // The panel that the popup shows, 'date' or 'time':
      activePanel: 'date',
      scrollContainer: null
    }
  },

  computed: {
    inputClasses() {
      return {
        'dito-input--has-errors': hasErrors(this.$attrs),
        'dito-input--disabled': this.disabled,
        // The field looks focused while its calendar is open:
        'dito-input--focus': this.open
      }
    },

    attributes() {
      const { class: _, ...attributes } = this.$attrs
      return attributes
    },

    months() {
      const { format } = new Intl.DateTimeFormat(this.locale, {
        month: 'short',
        timeZone: 'UTC'
      })
      return Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: format(Date.UTC(2000, index, 1))
      }))
    },

    years() {
      // Ten years around the year that the calendar shows, within the limits,
      // so that the native menu stays short. The year arrows reach further:
      const shown = this.shownDate.year
      const first = Math.max(shown - 10, this.minValue?.year ?? -Infinity)
      const last = Math.min(shown + 10, this.maxValue?.year ?? Infinity)
      return Array.from(
        { length: last - first + 1 },
        (_, index) => first + index
      )
    }
  },

  watch: {
    open(open) {
      this.$emit('update:open', open)
    }
  },

  mounted() {
    this.scrollContainer = getScrollContainer(this.$el)
  },

  methods: {
    setPlaceholder(fields) {
      this.shownDate = this.shownDate.set(fields)
    },

    // Select today, or the current time without the time parts that the
    // field doesn't edit:
    selectNow() {
      const date =
        this.granularity === 'day'
          ? getToday('day')
          : toCalendarDateTime(now(getLocalTimeZone())).set({
              millisecond: 0,
              ...(this.granularity !== 'second' && { second: 0 }),
              ...(this.granularity === 'hour' && { minute: 0 })
            })
      this.$emit('update:modelValue', date)
    },

    // Clicks outside the parts and the button, e.g. on the placeholder, focus
    // the first part:
    onMouseDown(event) {
      if (
        !this.disabled &&
        !event.target.closest('[contenteditable="true"], button')
      ) {
        this.focus()
        event.preventDefault()
      }
    },

    // Focusing or clicking a part opens the popup with the panel of the part,
    // also after it was closed while the part kept the focus:
    onPartFocus(event) {
      const { target } = event
      if (target.matches('[contenteditable="true"]')) {
        const part = target.dataset.rekaDateFieldSegment
        this.activePanel = timeParts.includes(part) ? 'time' : 'date'
        this.open = true
      }
    },

    // reka-ui focuses the calendar when the popup opens, and the button when
    // it closes, which a focused part prevents:
    keepPartFocused(event) {
      if (this.$el.querySelector('[contenteditable="true"]:focus')) {
        event.preventDefault()
      }
    },

    // Clicks on the field and the focus moving between its parts keep the
    // popup open:
    onInteractOutside(event) {
      const { target } = event
      if (this.$el.contains(target) && !target.closest('button')) {
        event.preventDefault()
      }
    },

    // The part that was picked in the time panel becomes the focused one:
    focusPart(name) {
      this.$el.querySelector(`[data-reka-date-field-segment="${name}"]`).focus()
    },

    focus() {
      this.$el.querySelector('[contenteditable="true"]')?.focus()
    },

    blur() {
      this.$el.querySelector(':focus')?.blur()
    }
  }
}

const timeParts = ['hour', 'minute', 'second', 'dayPeriod']

// Today, with a time for granularities finer than `day`:
function getToday(granularity) {
  const date = today(getLocalTimeZone())
  return granularity === 'day' ? date : toCalendarDateTime(date)
}
</script>

<style lang="scss">
@import '../styles/_imports';

// reka-ui marks empty parts with `data-placeholder`, but not the literals and
// the day period, which always have a value:
$entered-part: '.dito-date-segments__part:not([data-placeholder], ' +
  '[data-reka-date-field-segment="literal"], ' +
  '[data-reka-date-field-segment="dayPeriod"])';

.dito-date-picker {
  .dito-input {
    display: flex;
    min-width: 8em;
  }

  // Fields without entered parts hide them until focused, but keep them
  // focusable:
  &:not(:focus-within, :has(#{$entered-part})) .dito-date-segments__part {
    opacity: 0;
  }

  &:is(:focus-within, :has(#{$entered-part})) &__placeholder {
    display: none;
  }

  &__placeholder {
    position: absolute;
    color: $color-placeholder;
    pointer-events: none;
  }

  &__toggle {
    @extend %button--plain;

    display: flex;
  }
}

.dito-calendar {
  min-width: 240px;
  padding: 0 0.5em 0.5em;

  &__header {
    display: flex;
    align-items: center;
    gap: 0.25em;
    height: $input-height;
    margin: 0 -0.5em 0.25em;
    padding: 0 0.25em;
    border-bottom: $border-style;
  }

  &__select {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-weight: bold;
    border: 0;
    background: none;
  }

  &__step {
    @extend %button--plain;

    display: flex;
    align-items: center;
    justify-content: center;
    width: $input-height;
    height: $input-height;
  }

  // The years show two arrows, the months one:
  &__arrow {
    display: flex;

    &::before,
    &::after {
      display: block;
    }

    &--prev::before,
    &--prev-year::before,
    &--prev-year::after {
      @include arrow(6px, 'left', relative);
    }

    &--next::before,
    &--next-year::before,
    &--next-year::after {
      @include arrow(6px, 'right', relative);
    }

    &--prev-year::after,
    &--next-year::after {
      margin-left: -2px;
    }

    // In the color of the text, not the active one of the mixin:
    &::before,
    &::after {
      border-color: currentColor;
    }
  }

  &__footer {
    display: flex;
    justify-content: center;
    margin: 0.25em -0.5em -0.5em;
    border-top: $border-style;
  }

  &__now {
    @extend %button--plain;

    height: $input-height;
    padding: 0 1em;
  }

  &__grid {
    width: 100%;
    border-collapse: collapse;
  }

  &__weekday {
    // Columns of equal width. A fixed table layout would make the table as
    // wide as the popup can grow, as it sizes to its content:
    width: calc(100% / 7);
    font-weight: bold;
    height: $input-height;
  }

  &__day {
    height: $input-height;
    line-height: calc($input-height - 2 * $border-width);
    box-sizing: border-box;
    border: $border-width solid transparent;
    border-radius: $border-radius;
    text-align: center;
    cursor: pointer;
    outline: none;

    &:hover,
    &:focus-visible {
      background: $color-highlight;
    }

    &[data-today] {
      border-color: $color-active;
      color: $color-active;
    }

    &[data-selected] {
      &,
      &:hover {
        background: $color-active;
        color: $color-white;
      }
    }

    &[data-outside-view] {
      color: #999999;
    }

    &[data-disabled],
    &[data-unavailable] {
      color: $color-disabled;
      pointer-events: none;
    }
  }
}
</style>
