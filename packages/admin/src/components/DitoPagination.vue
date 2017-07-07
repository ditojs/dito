<template lang="pug">
  .dito-pagination
    .dito-pages {{ first }} – {{ last }} / {{ count }}
    router-link.dito-button(
      v-if="current > 1"
      :to="{ query: getQuery(current - 1) }"
      tag="button"
      type="button"
    ) ︎◀
    router-link.dito-button(
      v-for="page in pages"
      :to="{ query: getQuery(page) }"
      :key="`page_{page}`"
      tag="button"
      type="button"
      :class="{ 'dito-active': page === current }"
    ) {{ page }}
    router-link.dito-button(
      v-if="current < pages"
      :to="{ query: getQuery(current + 1) }"
      tag="button"
      type="button"
    ) ▶︎
</template>

<style lang="sass">
.dito
  .dito-pagination
    .dito-pages
      display: inline-block
      margin-right: 0.5em
    .dito-button
      width: 2em
      margin-left: 0.35em
      border-radius: 1em
      text-align: center
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

    first() {
      return this.offset + 1
    },

    last() {
      return Math.min(this.offset + this.limit, this.count)
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
