<template lang="pug">
  thead.dito-table-head
    tr
      th(
        v-for="(column, index) in columns"
      )
        router-link.dito-button(
          v-if="column.sortable"
          :to="getSortLink(column.name)"
          tag="button"
          type="button"
          :class="getSortClass(column.name)"
        )
          .dito-order-arrows
          span {{ column.label }}
        span(
          v-else
        ) {{ column.label }}
      th(v-if="hasButtons")
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-list-head', {
  props: {
    query: { type: Object, required: true },
    columns: { type: Array, required: true },
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
    getSortClass(name) {
      return this.sort.name === name
        ? `dito-active dito-order-${this.sort.order}`
        : null
    },

    getSortLink(name) {
      // Toggle order if the same column is clicked again.
      const order = this.sort.name === name && this.sort.order === 'asc'
        ? 'desc'
        : 'asc'
      return {
        query: {
          ...this.query,
          order: `${name} ${order}`
        }
      }
    }
  }
})
</script>
