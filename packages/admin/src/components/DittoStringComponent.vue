<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('string', {
  hideLabel: false
})
</script>

<template lang="pug">
input(:id="name", type="string")
</template>
