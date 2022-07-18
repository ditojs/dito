<template lang="pug">
  progress.dito-progress(
    ref="element"
    :id="dataPath"
    :value="progressValue"
    :max="progressMax"
    v-bind="attributes"
    v-on="listeners"
  )
</template>

<script>
import TypeComponent from '../TypeComponent.js'
import NumberMixin from '../mixins/NumberMixin.js'

// @vue/component
export default TypeComponent.register('progress', {
  mixins: [NumberMixin],
  computed: {
    progressValue() {
      let { value, range, step } = this
      if (value !== null) {
        if (range) {
          value -= range[0]
        }
        if (step) {
          value = Math.round(value / step) * step
        }
      } else {
        value = ''
      }
      return value
    },

    progressMax() {
      const { range } = this
      if (range) {
        return range[1] - range[0]
      }
    }
  }
})
</script>
