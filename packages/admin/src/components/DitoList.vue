<template lang="pug">
  div(:id="name")
    ul
      template(v-for="item in data")
        DitoListItem(:key="item.id", :item="item")
    router-link(:to="`${$route.path}/create`") Create
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('list', {
  props: ['name', 'data']
})
</script>
