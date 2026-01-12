<template lang="pug">
DitoInput.dito-text(
  :id="dataPath"
  ref="element"
  v-model="inputValue"
  :type="inputType"
  v-bind="attributes"
)
  template(#prefix)
    DitoAffixes(
      :items="schema.prefix"
      position="prefix"
      mode="input"
      :disabled="disabled"
      :parentContext="context"
    )
  template(#suffix)
    DitoAffixes(
      :items="schema.suffix"
      position="suffix"
      mode="input"
      :clearable="showClearButton"
      :disabled="disabled"
      :parentContext="context"
      @clear="clear"
    )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import TextMixin from '../mixins/TextMixin'
import DitoAffixes from '../components/DitoAffixes.vue'
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
    components: { DitoInput, DitoAffixes },
    nativeField: true,
    textField: true,
    ignoreMissingValue: ({ schema }) => schema.type === 'password',

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
