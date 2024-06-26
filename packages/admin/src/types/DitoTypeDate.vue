<template lang="pug">
.dito-date
  component(
    :is="getComponent(type)"
    :id="dataPath"
    ref="element"
    v-model="dateValue"
    :locale="locale"
    :format="formats"
    v-bind="attributes"
  )
    template(#after)
      button.dito-button-clear.dito-button-overlay(
        v-if="showClearButton"
        :disabled="disabled"
        @click.stop="clear"
        @mousedown.stop
      )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { DatePicker, TimePicker, DateTimePicker } from '@ditojs/ui/src'
import { isDate, assignDeeply } from '@ditojs/utils'

export default DitoTypeComponent.register(
  ['date', 'datetime', 'time'],
  // @vue/component
  {
    components: { DatePicker, TimePicker, DateTimePicker },
    // TODO: This is only here so we get placeholder added. Come up with a
    // better way to support attributes per component (a list of actually
    // supported attributes)
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

      // TODO: Rename to `format`, once `schema.format()` was removed to
      // `formatValue()`.
      formats: getSchemaAccessor('formats', {
        type: Object,
        default: null,
        get(formats) {
          const { date, time } = assignDeeply({}, this.api.formats, formats)
          return {
            date: ['date', 'datetime'].includes(this.type) ? date : null,
            time: ['time', 'datetime'].includes(this.type) ? time : null
          }
        }
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

    processValue({ value }) {
      return isDate(value) ? value.toISOString() : value
    }
  }
)
</script>
