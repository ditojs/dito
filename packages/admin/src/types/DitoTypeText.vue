<template lang="pug">
InputField.dito-text(
  :id="dataPath"
  ref="element"
  v-model="inputValue"
  :type="inputType"
  v-bind="attributes"
)
  template(#after)
    button.dito-button-clear.dito-button-overlay(
      v-if="showClearButton"
      :disabled="disabled"
      @click.stop="clear"
    )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import TextMixin from '../mixins/TextMixin'
import { InputField } from '@ditojs/ui/src'

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
    components: { InputField },
    nativeField: true,
    textField: true,
    ignoreMissingValue: schema => schema.type === 'password',

    computed: {
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
    },

    methods: {
      getValidations() {
        const rule = {
          email: 'email',
          url: 'url',
          hostname: 'hostname',
          domain: 'domain',
          password: 'password',
          creditcard: 'creditcard'
        }[this.type]
        return rule ? { [rule]: true } : {}
      }
    }
  }
)
</script>
