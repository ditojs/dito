<template lang="pug">
.dito-date
  component(
    :is="pickerComponents[schema.type]"
    :id="componentPath"
    ref="element"
    v-model="value"
    :locale="adminContext.api.locale"
    :format="format"
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
import { fieldProps, useField } from '../composables/useField.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import {
  DitoDatePicker,
  DitoTimePicker,
  DitoDateTimePicker
} from '@ditojs/ui/src'
import {
  isDate,
  isString,
  assignDeeply,
  formatPlainDate,
  parsePlainDate
} from '@ditojs/utils'

const pickerComponents = {
  date: DitoDatePicker,
  time: DitoTimePicker,
  datetime: DitoDateTimePicker
}

// @vue/component
const DitoTypeDate = {
  name: 'DitoTypeDate',
  components: { DitoInputAffixes },
  props: fieldProps,

  setup(props) {
    const field = useField(props, {
      // TODO: Only here to add `placeholder`. Support attributes per component.
      nativeField: true,
      textField: true
    })
    const { services, getSchemaValue } = field
    return {
      ...field,
      adminContext: services.adminContext,
      pickerComponents,

      format: computed(() => {
        const { type } = props.schema
        const { date, time } = assignDeeply(
          {},
          services.adminContext.api.formats,
          getSchemaValue('format', { type: Object, default: null })
        )
        return {
          date: ['date', 'datetime'].includes(type) ? date : null,
          time: ['time', 'datetime'].includes(type) ? time : null
        }
      })
    }
  }
}

defineType({
  type: ['date', 'datetime', 'time'],
  component: DitoTypeDate,
  hasFormat: true,

  // Edit dates as `Date` objects, plain dates in the local time zone:
  deserializeValue({ value }) {
    return isString(value) ? (parsePlainDate(value) ?? new Date(value)) : value
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

export default DitoTypeDate
</script>
