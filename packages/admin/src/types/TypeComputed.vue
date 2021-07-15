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
import TypeComponent from '@/TypeComponent'
import TypeMixin from '@/mixins/TypeMixin'
import DataMixin from '@/mixins/DataMixin'

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
        const value = this.handleDataSchema(this.schema, 'schema')
        const { data, name } = this
        if (value !== data[name]) {
          this.$set(data, name, value)
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
