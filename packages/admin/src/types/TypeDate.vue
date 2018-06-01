<template lang="pug">
  .dito-date
    component(
      :is="getComponent(type)"
      :id="dataPath"
      v-model="dateValue"
      v-validate="validations"
      v-bind="getAttributes()"
      v-on="getEvents()"
    )
</template>

<script>
import TypeComponent from '@/TypeComponent'
import DatePicker from '@ditojs/ui/src/components/DatePicker'
import TimePicker from '@ditojs/ui/src/components/TimePicker'
import DateTimePicker from '@ditojs/ui/src/components/DateTimePicker'

export default TypeComponent.register(['date', 'datetime', 'time'], {
  components: { DatePicker, TimePicker, DateTimePicker },

  computed: {
    dateValue: {
      get() {
        const { value } = this
        return value ? new Date(value) : value
      },

      set(value) {
        this.value = value
      }
    }
  },

  methods: {
    getComponent(type) {
      return {
        date: 'date-picker',
        time: 'time-picker',
        datetime: 'date-time-picker'
      }[type]
    },

    processValue(value) {
      // Convert to string for JSON
      return value ? value.toISOString() : value
    }
  }
})
</script>
