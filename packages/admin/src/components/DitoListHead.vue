<template lang="pug">
  thead.dito-table-head
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

  methods: {
    getSortParams() {
      return (this.query.order || '').split(/\s+/)
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
      return { ...this.query, order: `${name} ${order}` }
    }
  }
})
</script>
