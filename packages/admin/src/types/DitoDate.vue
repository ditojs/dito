<template lang="pug">
  input.dito-date.dito-input(
    :id="name"
    :name="name"
    :type="hasTime ? 'datetime-local' : 'date'"
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

export default DitoComponent.register(['date', 'datetime'], {
  watch: {
    value(value) {
      const input = this.$refs.input
      value = value ? this.toLocalDate(value) : value
      // Only set native value again in case it changed, to prevent resetting
      // input sequence in native date / datetime-local input fields.
      if (input.value !== value) {
        input.value = value
      }
    }
  },

  computed: {
    hasTime() {
      return this.type === 'datetime'
    }
  },

  methods: {
    onInput(event) {
      const value = event.target.value
      this.value = value ? new Date(value) : value
    },

    toLocalDate(value) {
      function pad(number, length) {
        const str = number + ''
        const pad = '0000'
        return pad.substring(0, (length || 2) - str.length) + str
      }

      const date = new Date(value)
      const Y = date.getFullYear()
      const M = date.getMonth() + 1
      const D = date.getDate()
      let str = `${pad(Y, 4)}-${pad(M)}-${pad(D)}`
      if (this.hasTime) {
        const h = date.getHours()
        const m = date.getMinutes()
        const s = date.getSeconds()
        str = `${str}T${pad(h)}:${pad(m)}`
        // Only add seconds if they're not zero to reflect chrome behavior
        if (this.schema.seconds && s) {
          str = `${str}:${pad(s)}`
        }
      }
      return str
    }
  }
})
</script>
