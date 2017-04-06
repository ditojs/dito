<template lang="pug">
  input(:id="name", type="text", v-model="data[name]", :disabled="disabled")
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.type('text')
</script>
