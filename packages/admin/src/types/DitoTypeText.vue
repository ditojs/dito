<template lang="pug">
DitoInput.dito-text(
  :id="componentPath"
  ref="element"
  v-model="inputValue"
  :type="inputTypes[schema.type] ?? schema.type"
  v-bind="attributes"
)
  template(#prefix)
    DitoInputAffixes(
      position="prefix"
      v-bind="inputAffixesProps.prefix"
    )
  template(#suffix)
    DitoInputAffixes(
      position="suffix"
      v-bind="inputAffixesProps.suffix"
      @clear="clear"
    )
</template>

<script>
import { computed } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { textTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import { DitoInput } from '@ditojs/ui/src'

const maskedPassword = '****************'

// The input types of the types that browsers don't know:
const inputTypes = {
  creditcard: 'text',
  hostname: 'text',
  domain: 'text'
}

// @vue/component
const DitoTypeText = {
  name: 'DitoTypeText',
  components: { DitoInput, DitoInputAffixes },
  props: fieldProps,

  setup(props) {
    const field = useField(props, { nativeField: true, textField: true })
    const { value, focused } = field
    return {
      ...field,
      inputValue: computed({
        get() {
          return (
            props.schema.type === 'password' &&
            value.value === undefined &&
            !focused.value
          )
            ? maskedPassword
            : value.value
        },

        set(inputValue) {
          value.value = inputValue
        }
      }),
      inputTypes
    }
  }
}

defineType({
  types: [
    'text',
    'email',
    'url',
    'hostname',
    'domain',
    'tel',
    'password',
    'creditcard'
  ],
  component: DitoTypeText,
  ...textTraits,
  ignoreMissingValue: ({ schema }) => schema.type === 'password',

  getValidations(schema) {
    const validationName = {
      email: 'email',
      url: 'url',
      hostname: 'hostname',
      domain: 'domain',
      password: 'password',
      creditcard: 'creditcard'
    }[schema.type]
    return validationName ? { [validationName]: true } : {}
  }
})

export default DitoTypeText
</script>
