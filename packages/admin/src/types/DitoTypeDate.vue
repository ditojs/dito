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
import { fieldProps, useField } from '../composables/useField.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import {
  DitoDatePicker,
  DitoTimePicker,
  DitoDateTimePicker
} from '@ditojs/ui/src'
import {
  isDate,
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
    const { value, services, getSchemaValue } = field
    return {
      ...field,
      adminContext: services.adminContext,
      pickerComponents,

      dateValue: computed({
        get() {
          const date = value.value
          return date ? (parsePlainDate(date) ?? new Date(date)) : date
        },

        set(date) {
          value.value = date
        }
      }),

      // TODO: Rename to `format`, once `schema.format()` was removed to
      // `formatValue()`.
      formats: computed(() => {
        const { type } = props.schema
        const { date, time } = assignDeeply(
          {},
          services.adminContext.api.formats,
          getSchemaValue('formats', { type: Object, default: null })
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

  processValue({ schema, value }) {
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
