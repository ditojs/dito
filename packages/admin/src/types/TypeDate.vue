<template lang="pug">
  .dito-date
    component(
      :is="getComponent(type)"
      ref="element"
      :id="dataPath"
      :locale="locale"
      :dateFormat="{ ...api.formats.date, ...dateFormat }"
      v-model="dateValue"
      v-bind="attributes"
      v-on="listeners"
    )
</template>

<script>
import TypeComponent from '../TypeComponent.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { DatePicker, TimePicker, DateTimePicker } from '@ditojs/ui'
import { isDate } from '@ditojs/utils'

export default TypeComponent.register([
  'date', 'datetime', 'time'
],
// @vue/component
{
  components: { DatePicker, TimePicker, DateTimePicker },
  // TODO: This is only here so we get placeholder added. Come up with a better
  // way to support attributes per component (a list of actually supported
  // attributes)
  nativeField: true,
  textField: true,

  computed: {
    dateValue: {
      get() {
        const { value } = this
        return value ? new Date(value) : value
      },

      set(value) {
        this.value = value
      }
    },

    dateFormat: getSchemaAccessor('dateFormat', {
      type: Object,
      default: null
    })
  },

  methods: {
    getComponent(type) {
      return {
        date: 'date-picker',
        time: 'time-picker',
        datetime: 'date-time-picker'
      }[type]
    }
  },

  processValue(schema, value) {
    return isDate(value) ? value.toISOString() : value
  }
})
</script>
