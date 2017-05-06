<template lang="pug">
  button.dito-button(:id="name", :type="desc.type") {{ desc.text }}
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('button')
</script>
