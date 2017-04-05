<template lang="pug">
  label {{ text }}
    slot
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-label', {
  props: ['text']
})
</script>
