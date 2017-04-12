<template lang="pug">
  input(:id="name", type="text", v-model="value", :disabled="disabled", :readonly="readonly", :placeholder="placeholder")
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('text')
</script>
