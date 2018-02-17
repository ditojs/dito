<template lang="pug">
  button.dito-button(:id="dataPath" :type="schema.type") {{ schema.text }}
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('button')
</script>
