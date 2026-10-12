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
import { defineType } from '../utils/schema/types.ts'
import { numberTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useNumber } from '../composables/useNumber.ts'

// @vue/component
const DitoTypeProgress = {
  name: 'DitoTypeProgress',
  props: fieldProps,

  setup(props) {
    const field = useField(props)
    const { settings } = useNumber(props, field)
    return {
      ...field,

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
}

defineType({
  types: ['progress'],
  component: DitoTypeProgress,
  ...numberTraits
})

export default DitoTypeProgress
</script>
