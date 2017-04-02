<template lang="pug">
  input(:id="name", type="text", :value="value")
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.type('text', {
  props: ['name', 'value']
})
</script>
