<template lang="pug">
  li
    span(v-html="render && render(item) || item.html || escape(item.text)")
    slot
</template>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-list-item', {
  props: ['item', 'render']
})
</script>
