<template lang="pug">
DitoInput.dito-text(
  :id="componentPath"
  ref="element"
  v-model="inputValue"
  :type="inputType"
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
import DitoTypeComponent from '../DitoTypeComponent.js'
import TextMixin from '../mixins/TextMixin'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import { getInputAffixesProps } from '../utils/affixes.js'
import { DitoInput } from '@ditojs/ui/src'

const maskedPassword = '****************'

export default DitoTypeComponent.register(
  [
    'text',
    'email',
    'url',
    'hostname',
    'domain',
    'tel',
    'password',
    'creditcard'
  ],
  // @vue/component
  {
    mixins: [TextMixin],
    components: { DitoInput, DitoInputAffixes },
    nativeField: true,
    textField: true,
    ignoreMissingValue: ({ schema }) => schema.type === 'password',

    getTypeValidations(schema) {
      const validationName = {
        email: 'email',
        url: 'url',
        hostname: 'hostname',
        domain: 'domain',
        password: 'password',
        creditcard: 'creditcard'
      }[schema.type]
      return validationName ? { [validationName]: true } : {}
    },

    computed: {
      inputAffixesProps() {
        return getInputAffixesProps(this)
      },

      inputType() {
        return (
          {
            creditcard: 'text',
            hostname: 'text',
            domain: 'text'
          }[this.type] ||
          this.type
        )
      },

      inputValue: {
        get() {
          return (
            this.type === 'password' &&
            this.value === undefined &&
            !this.focused
          )
            ? maskedPassword
            : this.value
        },

        set(value) {
          this.value = value
        }
      }
    }
  }
)
</script>
