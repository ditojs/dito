<template lang="pug">
  button(:type="desc.type") {{ desc.text }}
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('button')
</script>
