<template lang="pug">
  div(:id="name")
    ul
      dito-list-item(v-for="item in data", :key="item.id", :item="item")
        router-link(tag="button", :to="`${item.id}`", append) Edit
    router-link(tag="button", to="create", append) Create
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.type('list', {
  props: {
    data: { type: Array, required: false }
  }
})
</script>
