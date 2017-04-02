<template lang="pug">
  div(:id="name")
    ul
      dito-list-item(v-for="item in data", :key="item.id", :item="item")
    router-link(:to="`${$route.path}/create`") Create
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.type('list', {
  props: ['name', 'data']
})
</script>
