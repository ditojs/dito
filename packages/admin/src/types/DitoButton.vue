<template lang="pug">
  button.dito-button(:id="name" :type="schema.type") {{ schema.text }}
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('button')
</script>
