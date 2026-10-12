<template lang="pug">
progress.dito-progress(
  :id="componentPath"
  ref="element"
  :value="progressValue"
  :max="progressMax"
  v-bind="attributes"
)
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { numberDescriptor } from './descriptors.ts'
import NumberMixin from '../mixins/NumberMixin.js'

// @vue/component
const DitoTypeProgress = DitoTypeComponent.component('DitoTypeProgress', {
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

defineType({
  types: ['progress'],
  component: DitoTypeProgress,
  ...numberDescriptor
})

export default DitoTypeProgress
</script>
