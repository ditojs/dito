<template lang="pug">
  input(:id="name", type="text", v-model="data[name]", :disabled="disabled")
</template>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.type('text')
</script>
