<template lang="pug">
  li
    span(v-html="render && render(item) || item.html || escape(item.text)")
    slot
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-list-item', {
  props: ['item', 'render']
})
</script>
