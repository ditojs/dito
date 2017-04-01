<template lang="pug">
  li(v-html="item.html || escape(item.text)")
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('list-item', {
  props: ['item']
})
</script>
