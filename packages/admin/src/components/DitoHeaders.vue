<template lang="pug">
  thead.dito-header
    tr
      th(
        v-for="(column, index) in columns"
        :colspan="hasButtons && index === columns.length - 1 ? 2 : null"
      )
        router-link.dito-button(
          v-if="column.sortable"
          :to="{ query: getSortQuery(column.name) }"
          tag="button"
          type="button"
          :class="getSortClass(column.name)"
        )
          .dito-arrows
          .dito-column
            | {{ column.label }}
        .dito-column(v-else)
          | {{ column.label }}
</template>

<style lang="sass">
.dito
  .dito-header
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
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-headers', {
  props: {
    filter: { type: Object, required: true },
    columns: { type: Array, required: true },
    hasButtons: { type: Boolean, required: true }
  },

  methods: {
    getSortParams() {
      return (this.filter.order || '').split(' ')
    },

    getSortClass(name) {
      const [sortName, sortOrder] = this.getSortParams()
      return sortName === name
        ? `dito-active dito-order-${sortOrder}`
        : null
    },

    getSortQuery(name) {
      let [sortName, sortOrder] = this.getSortParams()
      // Toggle order if we're clicking the same column
      const order = sortName === name && sortOrder === 'asc' ? 'desc' : 'asc'
      return { ...this.filter, order: `${name} ${order}` }
    }
  }
})
</script>
