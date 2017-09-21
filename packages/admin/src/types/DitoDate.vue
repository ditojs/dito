<template lang="pug">
  input.dito-date.dito-input(
    :id="name"
    :name="name"
    :type="type === 'datetime' ? 'datetime-local' : type"
    :title="label"
    ref="input"
    @input="onInput"
    v-validate="validations"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :min="min && toLocalDate(min)"
    :max="max && toLocalDate(min)"
    :step="hasTime ? step || (schema.seconds ? 1 : 60) : step"
  )
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register(['date', 'datetime', 'time'], {
  watch: {
    value(value) {
      const {input} = this.$refs
      value = value ? this.toLocalDate(value) : value
      // Only set native value again in case it changed, to prevent resetting
      // input sequence in native date / datetime-local input fields.
      if (input.value !== value) {
        input.value = value
      }
    }
  },

  computed: {
    hasDate() {
      return /^date/.test(this.type)
    },

    hasTime() {
      return /time$/.test(this.type)
    }
  },

  methods: {
    onInput(event) {
      const {value} = event.target
      this.value = value ? new Date(value) : value
    },

    toLocalDate(value) {
      function pad(number, length) {
        const str = number + ''
        const pad = '0000'
        return pad.substring(0, (length || 2) - str.length) + str
      }

      const d = new Date(value)
      let date = ''
      if (this.hasDate) {
        const Y = d.getFullYear()
        const M = d.getMonth() + 1
        const D = d.getDate()
        date = `${pad(Y, 4)}-${pad(M)}-${pad(D)}`
      }
      let time = ''
      if (this.hasTime) {
        const h = d.getHours()
        const m = d.getMinutes()
        const s = d.getSeconds()
        time = `${pad(h)}:${pad(m)}`
        // Only add seconds if they're not zero to reflect chrome behavior
        if (this.schema.seconds && s) {
          time = `${time}:${pad(s)}`
        }
      }
      return date ? time ? `${date}T${time}` : date : time
    }
  }
})
</script>
