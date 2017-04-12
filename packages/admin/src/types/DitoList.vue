<template lang="pug">
  div
    ul.dito-list
      li(v-for="item in data[name]", :key="item.id")
        span(v-html="render(item)")
        .dito-buttons(v-if="desc.editable || desc.deletable",)
          router-link(v-if="desc.editable", tag="button", :to="`${item.id}`", append) Edit
          button(v-if="desc.deletable", @click="remove(item)") Delete
    .dito-buttons(v-if="desc.creatable")
      router-link(tag="button", to="create", append) Create
</template>

<style lang="sass">
  // Used both by DitoList and DitoPane
  ul.dito-list
    display: table
    border-spacing: 0.2em
    padding: 0 0 0.5em
    margin: 0
    li
      display: table-row
      margin: 0
      > *
        display: table-cell
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
      return desc.render ||
          desc.template && compile(desc.template, 'item') ||
          function(item) {
            return item.html || this.escapeHtml(item.text)
          }
    }
  },

  methods: {
    remove(item) {
      this.$emit('remove', item, this.render(item))
    }
  }
})
</script>
