<template lang="pug">
  .dito-list
    dito-errors(
      v-if="errors.has('dito-data')"
      name="dito-data"
    )
    .dito-scopes(v-if="scopes")
      button.dito-button(
        v-for="scope in scopes"
        type="button"
          :class="{ 'dito-active': scope.name === filterScope }"
        @click="filterByScope(scope.name || scope.label.toLowerCase())"
      )
        | {{ scope.label }}
    table
      thead
        tr(v-if="columns")
          th(
            v-for="(column, index) in columns"
            :colspan="hasButtons && index === columns.length - 1 ? 2 : null"
          )
            button.dito-button(
              v-if="column.sortable"
              type="button"
              :class="getSortClass(column.name)"
              @click="sortByColumn(column.name)"
            )
              .dito-arrows
              .dito-column
                | {{ column.label }}
            .dito-column(v-else)
              | {{ column.label }}
      vue-draggable(
        element="tbody"
        :list="listData"
        :options="dragOptions"
      )
        tr(
          v-for="item, index in listData || []"
          :key="`${name}-${item.id}`"
        )
          td(
            v-for="html in renderCells(item)"
            v-html="html"
          )
          td.dito-buttons(v-if="hasButtons")
            router-link.dito-button(
              v-if="desc.editable"
              :to="`${path}${getItemId(item, index)}`" append
              tag="button"
              type="button"
              :class="`dito-button-${verbEdit}`"
            )
            button.dito-button(
              v-if="desc.deletable"
              type="button"
              @click="deleteItem(item)"
              :class="`dito-button-${verbDelete}`"
            )
    .dito-buttons(v-if="desc.creatable")
      router-link.dito-button(
        :to="`${path}create`" append
        tag="button"
        type="button"
        :class="`dito-button-${verbCreate}`"
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
      td
        padding: $list-spacing 0 $list-spacing $form-spacing
        background: $color-lightest
      // Support simple nested table styling
      table
        border-spacing: 0
        td
          padding: 0
          & + td
            padding-left: $form-spacing
      th
        padding: 0
        background: $color-lighter
        font-weight: normal
        text-align: left
        & + th
          border-left: $border-style
        .dito-column
          padding: $button-padding-ver 0
          margin-left: $form-spacing
          // When there's no sort-button, add a 1px border to get same height
          &:first-child
            border: 1px solid transparent
        button
          padding: 0
          width: 100%
          text-align: inherit
          border-radius: 0
          &:hover
            background: $button-color-hover
          .dito-column,
          .dito-arrows
            display: inline-block
          .dito-arrows
            width: round($column-arrow-size * $math-sqrt2)
            padding-left: $form-spacing + $border-width
            $arrow-offset: $column-arrow-size / 2 + $border-width
            &::before
              +arrow($column-arrow-size, true)
              bottom: $arrow-offset
            &::after
              +arrow($column-arrow-size, false)
              top: $arrow-offset
          &.dito-order-asc .dito-arrows
            &::before
              bottom: 0
            &::after
              display: none
          &.dito-order-desc .dito-arrows
            &::before
              display: none
            &::after
              top: 0
      // Add rounded corners in first & last cells / headers
      td,
      th,
        &:first-child
          &,
          button
            border-top-left-radius: $border-radius
            border-bottom-left-radius: $border-radius
        &:last-child
          &,
          button
            border-top-right-radius: $border-radius
            border-bottom-right-radius: $border-radius
    .dito-drag-ghost
      opacity: 0
    .dito-buttons
      text-align: right
      padding: $list-spacing
      background: $color-lightest
      border-radius: $border-radius
    .dito-scopes
      padding-bottom: $menu-padding-ver
      // font-size: 0.9em
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
          &:active
            border-left-color: $border-color
</style>

<script>
import DitoComponent from '@/DitoComponent'
import VueDraggable from 'vuedraggable'
import ListMixin from '@/mixins/ListMixin'

export default DitoComponent.register('list', {
  mixins: [ListMixin],
  components: {VueDraggable},

  computed: {
    hasButtons() {
      return this.desc.editable || this.desc.deletable
    },

    dragOptions() {
      return {
        animation: 150,
        disabled: !this.desc.draggable,
        ghostClass: 'dito-drag-ghost'
      }
    }
  },

  methods: {
    getSortClass(name) {
      return this.sortKey === name
        ? `dito-active dito-order-${this.sortOrder > 0 ? 'asc' : 'desc'}`
        : null
    }
  }
})
</script>
