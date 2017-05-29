<template lang="pug">
  .dito-list
    dito-errors(
      v-if="errors.has('dito-data')",
      name="dito-data"
    )
    .dito-scopes(v-if="desc.scopes")
      button.dito-button(
        v-for="scope in desc.scopes",
        type="button",
        @click="filterByScope({ scope: scope.toLowerCase() })"
      )
        | {{ scope }}
    ul.dito-table
      li(
        v-for="item in listData || []",
        :key="`${name}-${item.id}`"
      )
        span(
          v-for="html in render(item)",
          v-html="html"
        )
        .dito-buttons(v-if="desc.editable || desc.deletable")
          router-link(
            v-if="desc.editable",
            :to="`${route}${item.id}`", append,
            tag="button",
            type="button",
            class="dito-button dito-button-edit"
          )
          button.dito-button.dito-button-delete(
            v-if="desc.deletable",
            type="button",
            @click="remove(item)"
          )
    .dito-buttons(v-if="desc.creatable")
      router-link(
        :to="`${route}create`", append,
        tag="button",
        type="button",
        class="dito-button dito-button-create"
      )
</template>

<style lang="sass">
$list-spacing: 3px

.dito
  .dito-list
    .dito-table
      width: 100%
      border-spacing: 0 $list-spacing
      margin: -$list-spacing 0
      > li
        > *
          background: $color-lightest
          padding: $list-spacing 0
          padding-left: $form-spacing
          &:first-child
            border-top-left-radius: $border-radius
            border-bottom-left-radius: $border-radius
          &:last-child
            border-top-right-radius: $border-radius
            border-bottom-right-radius: $border-radius
            padding-right: $list-spacing
    // Support simple nested tables
    table
      border-spacing: 0
      tbody
        vertical-align: inherit
      td
        padding: 0
        & + td
          padding-left: $form-spacing
    .dito-buttons
      text-align: right
      padding: $list-spacing
      margin-top: $list-spacing
      background: $color-lightest
      border-radius: $border-radius
    .dito-scopes
      padding-bottom: $menu-padding-ver
      font-size: 0.9em
      .dito-button
        border-radius: 0
        border-top-left-radius: 1em
        border-bottom-left-radius: 1em
        padding-left: 1em
        padding-right: 1em
        & + .dito-button
          border-radius: 0
          border-top-right-radius: 1em
          border-bottom-right-radius: 1em
          border-left: 1px solid $border-color
          &:focus
            border-left-color: $color-active
</style>

<script>
import DitoComponent from '@/DitoComponent'
import ListMixin from '@/mixins/ListMixin'
import escapeHtml from '@/utils/escapeHtml'
import stripTags from '@/utils/stripTags'

export default DitoComponent.register('list', {
  mixins: [ListMixin],

  computed: {
    render() {
      const desc = this.desc
      const render = desc.render
      return function(item) {
        const res = render && render(item) || item.html || escapeHtml(item.text)
        return Array.isArray(res) ? res : [res]
      }
    }
  },

  methods: {
    getTitle(item) {
      const res = this.render(item)
      return stripTags(Array.isArray(res) ? res[0] : res)
    }
  }
})
</script>
