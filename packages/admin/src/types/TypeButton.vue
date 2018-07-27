<template lang="pug">
  button.dito-button(
    ref="element"
    :id="dataPath"
    :type="schema.type"
  ) {{ schema.text }}
</template>

<script>
import TypeComponent from '@/TypeComponent'

// @vue/component
export default TypeComponent.register('button', {
  defaultValue: undefined
})
</script>
