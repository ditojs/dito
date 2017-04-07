<template lang="pug">
  label {{ text }}
    slot
</template>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-label', {
  props: ['text']
})
</script>
