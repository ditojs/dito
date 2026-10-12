import { computed } from 'vue'
import { getNumberSettings } from '../types/descriptors.ts'
import type { Field, FieldProps } from './useField.ts'

// The settings and the input value of number types, see `getNumberSettings()`.
export function useNumber(
  props: FieldProps,
  { value, context }: Pick<Field, 'value' | 'context'>
) {
  const isInteger = computed(() => props.schema.type === 'integer')
  const settings = computed(() => getNumberSettings(props.schema, context))
  return {
    settings,

    // The `step` attribute of inputs, `'any'` for numbers without steps:
    stepValue: computed(() => {
      const { step } = settings.value
      return step == null && !isInteger.value ? 'any' : step
    }),

    // The value of inputs, which are empty for `null`:
    inputValue: computed<number | ''>({
      get() {
        return value.value !== null ? value.value : ''
      },

      set(inputValue) {
        value.value =
          inputValue !== ''
            ? isInteger.value
              ? Number(inputValue)
              : parseFloat(`${inputValue}`)
            : null
      }
    })
  }
}
