<template lang="pug">
progress.dito-progress(
  :id="dataPath"
  :value="progressValue"
  :max="progressMax"
  v-bind="attributes"
)
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import NumberMixin from '../mixins/NumberMixin.js'

// @vue/component
export default DitoTypeComponent.register('progress', {
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
      return range ? range[1] - range[0] : null
    }
  }
})
</script>
