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
import { computed } from 'vue'
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { numberDescriptor } from './descriptors.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useNumber } from '../composables/useNumber.ts'

// @vue/component
const DitoTypeProgress = DitoComponent.component('DitoTypeProgress', {
  props: fieldProps,

  setup(props) {
    const field = useField(props)
    const { settings } = useNumber(props, field)
    return {
      attributes: field.attributes,
      focus: field.focus,

      progressValue: computed(() => {
        let value = field.value.value
        const { range, step } = settings.value
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
      }),

      progressMax: computed(() => {
        const { range } = settings.value
        return range ? range[1] - range[0] : null
      })
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
