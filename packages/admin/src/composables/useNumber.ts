import { computed } from 'vue'
import { getNumberSettings } from '../types/traits.ts'
import type { Field, FieldProps } from './useField.ts'

export function useNumber(
  props: FieldProps,
  { value, context }: Pick<Field, 'value' | 'context'>
) {
  const isInteger = computed(() => props.schema.type === 'integer')
  const settings = computed(() => getNumberSettings(props.schema, context))
  return {
    settings,

    // Numbers without steps accept any value:
    stepValue: computed(() => {
      const { step } = settings.value
      return step == null && !isInteger.value ? 'any' : step
    }),

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
