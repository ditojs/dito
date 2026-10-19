<template lang="pug">
DitoProgress(
  :id="componentPath"
  ref="element"
  :value="progressValue"
  :min="settings.min"
  :max="settings.max"
  v-bind="attributes"
)
</template>

<script>
import { computed } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { numberTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useNumber } from '../composables/useNumber.ts'
import { DitoProgress } from '@ditojs/ui/src'

// @vue/component
const DitoTypeProgress = {
  components: { DitoProgress },
  props: fieldProps,

  setup(props) {
    const field = useField(props)
    const { settings } = useNumber(props, field)
    return {
      ...field,
      settings,

      progressValue: computed(() => {
        const { min = 0, step } = settings.value
        // Show empty values as an empty bar, not as an indeterminate one:
        const value = field.value.value ?? min
        // Round to the steps from the start of the range:
        return step ? min + Math.round((value - min) / step) * step : value
      })
    }
  }
}

defineType({
  type: 'progress',
  component: DitoTypeProgress,
  ...numberTraits
})

export default DitoTypeProgress
</script>
