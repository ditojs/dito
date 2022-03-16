<template lang="pug">
  thead.dito-table-head
    tr
      th(
        v-for="(column, index) in columns"
        v-if="shouldRender(column)"
        :class="getColumnClass(column)"
      )
        router-link(
          v-if="column.sortable"
          :to="getSortLink(column)"
          custom v-slot="{ navigate }"
        )
          button.dito-button(
            type="button"
            :class="getSortClass(column)"
            @click="navigate"
          )
            .dito-order-arrows
            span {{ getLabel(column) }}
        span(
          v-else
        ) {{ getLabel(column) }}
      th(v-if="hasEditButtons")
        // Empty <span> is needed for styling, see _table.sass
        span
</template>

<style lang="sass">
  .dito-table-head
    +user-select(none)
    tr
      th
        padding: 0
        font-weight: normal
        text-align: left
        white-space: nowrap
        .dito-button
          // Convention: Nested spans handle padding, see below
          padding: 0
          width: 100%
          text-align: inherit
          border-radius: 0
        span
          display: inline-block
          // Convention: Nested spans handle padding
          padding: $input-padding
          &:empty::after
            // Prevent empty <th> from collapsing
            content: '\200b' // zero-width space
        > span
          display: block
</style>

<script>
import DitoComponent from '../DitoComponent.js'
import { hyphenate } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-table-head', {
  props: {
    query: { type: Object, required: true },
    columns: { type: Object, required: true },
    hasEditButtons: { type: Boolean, required: true }
  },

  computed: {
    sort() {
      const order = (this.query.order || '').split(/\s+/)
      return {
        name: order[0],
        order: order[1]
      }
    }
  },

  methods: {
    getColumnClass(column) {
      return `dito-column-${hyphenate(column.name)}`
    },

    getSortClass(column) {
      return this.sort.name === column.name
        ? `dito-selected dito-order-${this.sort.order}`
        : null
    },

    getSortLink(column) {
      // Toggle order if the same column is clicked again.
      const order = this.sort.name === column.name && this.sort.order === 'asc'
        ? 'desc'
        : 'asc'
      return this.getQueryLink({
        ...this.query,
        order: `${column.name} ${order}`
      })
    }
  }
})
</script>
