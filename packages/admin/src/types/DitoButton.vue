<template lang="pug">
  button(:id="name", :type="desc.type") {{ desc.text }}
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.type('button')
</script>
