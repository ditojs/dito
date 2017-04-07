<template lang="pug">
  .dito-list(:id="name")
    ul
      dito-list-item(v-for="item in data", :key="item.id", :item="item", :render="render")
        .dito-buttons
          router-link(tag="button", :to="`${item.id}`", append) Edit
          button(@click="$emit('remove', item)") Delete
    .dito-buttons
      router-link(tag="button", to="create", append) Create
</template>

<style lang="sass">
  .dito-list
    ul
      display: table
      border-spacing: 0.2em
    li
      display: table-row
      > *
        display: table-cell
    ul, li
      margin: 0
      padding: 0
</style>

<script>
import TypeComponent from '@/TypeComponent'
import { compile } from '@/utils/template'

export default TypeComponent.register('list', {
  props: {
    data: { type: [Array, Object], required: false }
  },

  computed: {
    render() {
      const desc = this.desc
      return desc.render || desc.template && compile(desc.template, 'item')
    }
  }
})
</script>
