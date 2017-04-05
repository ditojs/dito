<template lang="pug">
  input(:id="name", type="text", v-model="data[name]")
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.type('text')
</script>
