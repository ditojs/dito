<template lang="pug">
  //- TODO: Find a better way to trigger evaluation of `value` that dose not
  //- involve actually rendering it when the component is not visible.
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
import DitoContext from '@/DitoContext'
import { isFunction, isPromise } from '@ditojs/utils'

// TODO: Consider merging these three types to one: 'data', 'hidden', 'computed'

// @vue/component
export default TypeComponent.register('data', {
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  defaultVisible: false,

  computed: {
    value: {
      get() {
        const { name, data } = this
        const { data: dataSchema } = this.schema
        if (dataSchema && data[name] === undefined) {
          let value = isFunction(dataSchema)
            ? dataSchema.call(this, new DitoContext(this, {
              // Override value to prevent endless recursion through calling
              // the getter for `this.value` in `DitoContext`:
              value: data[name]
            }))
            : dataSchema
          // Support async data loading:
          if (isPromise(value)) {
            value.then(value => {
              this.$set(data, name, value)
            }).catch(console.error)
            // Set to `null` instead of `undefined` during loading,
            // to avoid calling `data()` endlessly.
            value = null
          }
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
