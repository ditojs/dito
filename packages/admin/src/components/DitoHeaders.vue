<template lang="pug">
  thead.dito-headers
    tr
      th(
        v-for="(column, index) in columns"
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
      th(v-if="hasButtons")
</template>

<style lang="sass">
$arrow-size: 4px

.dito
  .dito-headers
    +user-select(none)
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
      button
        padding: 0
        width: 100%
        text-align: inherit
        border-radius: 0
        .dito-column,
        .dito-arrows
          display: inline-block
        .dito-arrows
          width: round($arrow-size * $math-sqrt2)
          padding-left: $form-spacing + $border-width
          $arrow-offset: $arrow-size / 2 + $border-width
          &::before
            +arrow($arrow-size, 'up')
            bottom: $arrow-offset
          &::after
            +arrow($arrow-size, 'down')
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
      const [sortName, sortOrder] = this.getSortParams()
      // Toggle order if we're clicking the same column
      const order = sortName === name && sortOrder === 'asc' ? 'desc' : 'asc'
      return { ...this.filter, order: `${name} ${order}` }
    }
  }
})
</script>
