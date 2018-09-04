<template lang="pug">
  thead.dito-table-head
    tr
      th(
        v-for="(column, index) in columns"
        :class="getColumnClass(column)"
      )
        router-link.dito-button(
          v-if="column.sortable"
          :to="getSortLink(column)"
          tag="button"
          type="button"
          :class="getSortClass(column)"
        )
          .dito-order-arrows
          span {{ getLabel(column) }}
        span(
          v-else
        ) {{ getLabel(column) }}
      th(v-if="hasButtons")
</template>

<script>
import DitoComponent from '@/DitoComponent'
import { hyphenate } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-table-head', {
  props: {
    query: { type: Object, required: true },
    columns: { type: Object, required: true },
    hasButtons: { type: Boolean, required: true }
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
      return {
        query: {
          ...this.query,
          order: `${column.name} ${order}`
        }
      }
    }
  }
})
</script>
