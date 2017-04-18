<template lang="pug">
  .dito-error(v-if="error") {{ error }}
  div(v-else)
    ul.dito-list
      li(v-for="item in listData || []", :key="`${name}-${item.id}`")
        span(v-html="render(item)")
        .dito-buttons(v-if="desc.editable || desc.deletable",)
          router-link(v-if="desc.editable", tag="button",
            :to="`${route}/${item.id}`", append) Edit
          button(v-if="desc.deletable", @click.prevent="remove(item)") Delete
    .dito-buttons(v-if="desc.creatable")
      router-link(tag="button", :to="`${route}/create`", append) Create
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
import DitoComponent from '@/DitoComponent'
import ListMixin from '@/mixins/ListMixin'
import { compile } from '@/utils/template'
import escapeHtml from '@/utils/escapeHtml'
import stripTags from '@/utils/stripTags'

export default DitoComponent.register('list', {
  mixins: [ListMixin],

  computed: {
    render() {
      const desc = this.desc
      return desc.render ||
          desc.template && compile(desc.template, 'item') ||
          (item => item.html || escapeHtml(item.text))
    }
  },

  methods: {
    getTitle(item) {
      return stripTags(this.render(item))
    }
  }
})
</script>
