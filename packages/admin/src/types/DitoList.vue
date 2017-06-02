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
    table
      tr(v-if="columns")
        th(
          v-for="(column, index) in columns",
          :colspan="hasButtons && index === columns.length - 1 ? 2 : null"
        )
          a(
            v-if="column.sortable",
            href="#",
            @click.prevent=""
          )
            .dito-arrows
            .dito-column
              | {{ column.label }}
          .dito-column(v-else)
            | {{ column.label }}
      tr(
        v-for="item in listData || []",
        :key="`${name}-${item.id}`"
      )
        td(
          v-for="html in renderCells(item)",
          v-html="html"
        )
        td.dito-buttons(v-if="hasButtons")
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
@import 'mixins/arrow'

$list-spacing: 3px

.dito
  .dito-list
    table
      width: 100%
      border-spacing: 0 $list-spacing
      &:not(:empty)
        margin: -$list-spacing 0
        & + .dito-buttons
          margin-top: $list-spacing
      tr
        vertical-align: baseline
      td,
      th,
      th a,
        padding: 0
        &:first-child
          border-top-left-radius: $border-radius
          border-bottom-left-radius: $border-radius
        &:last-child
          border-top-right-radius: $border-radius
          border-bottom-right-radius: $border-radius
      td
        padding: $list-spacing 0
        padding-left: $form-spacing
        background: $color-lightest
      th
        background: $color-lighter
        font-weight: normal
        text-align: left
        padding-left: $border-width
        & + th
          border-left: $border-style
        .dito-column
          padding: $list-spacing 0
          padding-left: $form-spacing
        a
          display: block
          position: relative
          &:hover
            background-color: darken($color-lighter, 2.5%)
          .dito-column,
          .dito-arrows
            display: inline-block
          .dito-arrows
            width: round($column-arrow-size * $math-sqrt2)
            padding-left: $form-spacing
            $arrow-offset: $column-arrow-size / 2 + 1px
            &::before
              +arrow($column-arrow-size, true)
              bottom: $arrow-offset
            &::after
              +arrow($column-arrow-size, false)
              top: $arrow-offset
      // Support simple nested table styling
      table
        border-spacing: 0
        td
          padding: 0
          & + td
            padding-left: $form-spacing
    .dito-buttons
      text-align: right
      padding: $list-spacing
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
          border-left: $border-style
          &:focus
            border-left-color: $color-active
</style>

<script>
import DitoComponent from '@/DitoComponent'
import ListMixin from '@/mixins/ListMixin'
import escapeHtml from '@/utils/escapeHtml'
import stripTags from '@/utils/stripTags'
import isObject from 'isobject'

export default DitoComponent.register('list', {
  mixins: [ListMixin],

  computed: {
    columns() {
      const columns = this.desc.columns
      return Array.isArray(columns)
        ? columns.map(value => (
          isObject(value) ? value : { label: value }
        ))
        : isObject(columns)
          ? Object.entries(columns).map(([name, value]) => (
            isObject(value) ? { ...value, name } : { label: value, name }
          ))
          : null
    },

    renderCells() {
      const render = this.desc.render
      const columns = this.columns
      const firstColumn = columns && columns[0]
      return !render && firstColumn && firstColumn.name
        // If we have named columns, map their names to item attributes, with
        // optional per-column render() functions:
        ? item => {
          return columns.map(column => {
            const value = item[column.name]
            return column.render
              ? column.render.call(item, value)
              : value
          })
        }
        : item => {
          const res = render && render(item) ||
            item.html || escapeHtml(item.text)
          const cells = Array.isArray(res) ? res : [res]
          // Make sure we have the right amount of cells for the table
          if (columns) {
            cells.length = columns.length
          }
          return cells
        }
    },

    hasButtons() {
      return this.desc.editable || this.desc.deletable
    }
  },

  methods: {
    getTitle(item) {
      return stripTags(this.renderCells(item)[0])
    },

    isObject
  }
})
</script>
