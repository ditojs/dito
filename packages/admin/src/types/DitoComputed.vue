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
import DitoTypeComponent from '@/DitoTypeComponent'

// @vue/component
export default DitoTypeComponent.register('computed')
</script>
