<template lang="pug">
  //- TODO: Find a better way to trigger evaluation of `value` that dose not
  //  involve actually rendering it when the component is not visible.
  input.dito-text.dito-input(
    ref="element"
    :id="dataPath"
    :name="name"
    type="text"
    :value="value"
    :disabled="disabled"
    :readonly="true"
  )
</template>

<script>
import TypeComponent from '../TypeComponent.js'
import TypeMixin from '../mixins/TypeMixin.js'
import DataMixin from '../mixins/DataMixin.js'

export default TypeComponent.register([
  'computed', 'data', 'hidden'
],
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
          const value = this.handleDataSchema(schema, 'schema', {
            // Modifying `this.data` below triggers another call of the `value`
            // getter, so use a value of 2 for `resolveCounter` to return the
            // resolved data twice.
            resolveCounter: 2
          })
          this.$set(this.data, this.name, value)
        }
        return TypeMixin.computed.value.get.call(this)
      },

      set(value) {
        TypeMixin.computed.value.set.call(this, value)
      }
    }
  }
})
</script>
