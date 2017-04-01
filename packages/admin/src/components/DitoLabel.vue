<template lang="pug">
  label {{ text }}
    slot
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('label', {
  props: ['name', 'text']
})
</script>
