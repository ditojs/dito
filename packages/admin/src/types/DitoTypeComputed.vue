<template lang="pug">
//- TODO: Find a better way to trigger evaluation of `value` that dose not
//- involve actually rendering it when the component is not visible.
input.dito-text.dito-input(
  :id="dataPath"
  ref="element"
  :name="name"
  type="text"
  :value="value"
  :disabled="disabled"
  :readonly="true"
)
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import ValueMixin from '../mixins/ValueMixin.js'
import DataMixin from '../mixins/DataMixin.js'

export default DitoTypeComponent.register(
  ['computed', 'data', 'hidden'],
  // @vue/component
  {
    mixins: [DataMixin],

    defaultValue: () => undefined, // Callback to override `defaultValue: null`
    defaultVisible: false,

    computed: {
      value: {
        get() {
          const { schema } = this
          if (schema.data || schema.dataPath) {
            const value = this.handleDataSchema(schema, 'value')
            // TODO: Fix side-effects
            // eslint-disable-next-line max-len
            // eslint-disable-next-line vue/no-side-effects-in-computed-properties
            this.data[this.name] = value
          }
          return ValueMixin.computed.value.get.call(this)
        },

        set(value) {
          ValueMixin.computed.value.set.call(this, value)
        }
      }
    }
  }
)
</script>
