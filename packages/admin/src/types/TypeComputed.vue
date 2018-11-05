<template lang="pug">
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

// @vue/component
export default TypeComponent.register('computed')
</script>
