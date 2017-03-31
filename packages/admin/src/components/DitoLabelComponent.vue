<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('label', {
})
</script>

<template lang="pug">
label {{ desc.label }}
  slot
</template>

