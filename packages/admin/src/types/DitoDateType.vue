<template lang="pug">
.dito-date(
  @focusin="onFocusIn"
  @focusout="onFocusOut"
)
  component(
    :is="schema.type === 'time' ? DitoTimeInput : DitoDatePicker"
    ref="element"
    v-model="dateValue"
    v-bind="fieldProps"
  )
    template(#prefix)
      DitoInputAffixes(
        v-if="inputAffixesProps.hasPrefix"
        position="prefix"
        v-bind="inputAffixesProps.prefix"
        absolute
      )
    template(#suffix)
      DitoInputAffixes(
        v-if="inputAffixesProps.hasSuffix"
        position="suffix"
        v-bind="inputAffixesProps.suffix"
        absolute
        @clear="clear"
      )
</template>

<script>
import { computed } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { getSchemaValue } from '../utils/schema/value.js'
import { fieldProps, useField } from '../composables/useField.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import { DitoDatePicker, DitoTimeInput } from '@ditojs/ui/src'
import {
  fromDate,
  getLocalTimeZone,
  toCalendarDate,
  toCalendarDateTime,
  today
} from '@internationalized/date'
import { convertToDate } from '../utils/date.js'
import { isDate, assignDeeply, formatPlainDate } from '@ditojs/utils'

// @vue/component
const DitoDateType = {
  components: { DitoInputAffixes },
  props: fieldProps,

  setup(props) {
    // Text fields keep `readonly` fields focusable instead of disabling them:
    const field = useField(props, { nativeField: true, textField: true })
    const { services, context, value, attributes } = field
    return {
      ...field,
      DitoDatePicker,
      DitoTimeInput,

      // The parts of the time and `hour12` come from the time format:
      fieldProps: computed(() => {
        const { time } = getFormats(props.schema, context)
        const isTime = props.schema.type === 'time'
        const { title, ...attrs } = attributes.value
        return {
          'locale': services.adminContext.api.locale,
          'granularity': !time
            ? 'day'
            : time.second
              ? 'second'
              : time.minute
                ? 'minute'
                : 'hour',
          'hourCycle':
            time?.hour12 != null ? (time.hour12 ? 12 : 24) : undefined,
          // Typing a time without a value keeps today's date:
          'defaultPlaceholder': isTime
            ? toCalendarDateTime(today(getLocalTimeZone()))
            : undefined,
          'disabled': attrs.disabled,
          'readonly': attrs.readonly,
          'aria-label': title,
          'aria-labelledby': attrs['aria-labelledby'],
          'aria-invalid': attrs['aria-invalid'],
          'aria-describedby': attrs['aria-describedby']
        }
      }),

      // The fields edit dates of `@internationalized/date` in the local time
      // zone. Strings written by code stay in the data until the user edits
      // them:
      dateValue: computed({
        get: () => {
          const date = convertToDate(value.value)
          return isDate(date) ? toDateValue(date, props.schema.type) : null
        },
        set(dateValue) {
          value.value = dateValue?.toDate(getLocalTimeZone()) ?? null
          field.onChange()
        }
      }),

      // The field is focused while one of its parts or its popup is:
      onFocusIn(event) {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          field.onFocus()
        }
      },

      onFocusOut(event) {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          field.onBlur()
        }
      }
    }
  }
}

defineType({
  type: ['date', 'datetime', 'time'],
  component: DitoDateType,

  // Times are sent as full date-times:
  getProperty: ({ type }) => ({ type: type === 'date' ? 'date' : 'datetime' }),

  // Edit dates as `Date` objects:
  deserializeValue({ value }) {
    return convertToDate(value)
  },

  getValidations: () => ({ date: true }),

  getDisplayValue(context) {
    const { schema, value, format } = context
    const { date, time } = getFormats(schema, context)
    const dateValue = convertToDate(value)
    return isDate(dateValue)
      ? format(dateValue, { date: date ?? false, time: time ?? false })
      : value
  },

  serializeValue({ schema, value }) {
    // Send plain dates, so they can't shift to another day through time zones:
    return isDate(value)
      ? schema.type === 'date'
        ? formatPlainDate(value)
        : value.toISOString()
      : value
  }
})

export default DitoDateType

// A date of `@internationalized/date` with the local day and time of `date`:
function toDateValue(date, type) {
  const zoned = fromDate(date, getLocalTimeZone())
  return type === 'date' ? toCalendarDate(zoned) : toCalendarDateTime(zoned)
}

// The date and time formats of the type, `null` for the parts it doesn't show:
function getFormats(schema, context) {
  const { type } = schema
  const { date, time } = assignDeeply(
    {},
    context.api.formats,
    getSchemaValue('formats', { type: Object, default: null, schema, context })
  )
  return {
    date: ['date', 'datetime'].includes(type) ? date : null,
    time: ['time', 'datetime'].includes(type) ? time : null
  }
}
</script>
