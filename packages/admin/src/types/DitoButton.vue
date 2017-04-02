<template lang="pug">
  button(:id="name", :type="type") {{ text }}
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.type('button', {
  props: ['name', 'type', 'text']
})
</script>
