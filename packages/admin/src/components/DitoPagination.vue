<template lang="pug">
  .dito-pagination
    | {{ offset + 1 }} … {{ offset + limit }} of {{ count }}
    router-link.dito-button(
      v-for="page in pages"
      :to="{ query: getQuery(page) }"
      :key="`page_{page}`"
      tag="button"
      type="button"
      :class="{ 'dito-active': page === current }"
    )
      | {{ page }}
</template>

<style lang="sass">
.dito
  .dito-pagination
    .dito-button
      margin-left: 0.35em
      border-radius: 1em
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-pagination', {
  props: {
    filter: { type: Object, required: true },
    paginate: { type: Number, required: true },
    count: { type: Number, required: true }
  },

  computed: {
    offset() {
      return +this.filter.offset || 0
    },

    limit() {
      return +this.filter.limit || this.paginate
    },

    pages() {
      return Math.ceil(this.count / this.limit)
    },

    current() {
      return Math.floor(this.offset / this.limit) + 1
    }
  },

  methods: {
    getQuery(page) {
      return { ...this.filter, offset: (page - 1) * this.limit }
    }
  }
})
</script>
