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

export default TypeComponent.register([
  'computed', 'hidden'
],
// @vue/component
{
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  defaultVisible: false
})
</script>
