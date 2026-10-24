<template lang="pug">
.dito-date
  component(
    :is="pickerComponents[schema.type]"
    :id="componentPath"
    ref="element"
    v-model="dateValue"
    :locale="adminContext.api.locale"
    :format="formats"
    v-bind="attributes"
  )
    template(#prefix)
      DitoInputAffixes(
        position="prefix"
        v-bind="inputAffixesProps.prefix"
        absolute
      )
    template(#suffix)
      DitoInputAffixes(
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
import {
  DitoDatePicker,
  DitoTimePicker,
  DitoDateTimePicker
} from '@ditojs/ui/src'
import { convertToDate } from '../utils/date.js'
import {
  isDate,
  isString,
  assignDeeply,
  formatPlainDate
} from '@ditojs/utils'

const pickerComponents = {
  date: DitoDatePicker,
  time: DitoTimePicker,
  datetime: DitoDateTimePicker
}

// @vue/component
const DitoDateType = {
  components: { DitoInputAffixes },
  props: fieldProps,

  setup(props) {
    const field = useField(props, {
      nativeField: true,
      textField: true
    })
    const { services, context, value } = field
    return {
      ...field,
      adminContext: services.adminContext,
      pickerComponents,
      formats: computed(() => getFormats(props.schema, context)),

      // Strings written by code stay in the data until the user edits them.
      // The picker only shows dates:
      dateValue: computed({
        get: () => {
          const date = convertToDate(value.value)
          return isString(date) ? null : date
        },
        set(date) {
          value.value = date
        }
      })
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
