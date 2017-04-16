<template lang="pug">
  input(:id="name", type="text", v-model="data[name]", :disabled="disabled",
    :readonly="readonly", :placeholder="placeholder")
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('text')
</script>
