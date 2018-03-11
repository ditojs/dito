<template lang="pug">
  mixin nbsp
    | !{' '}
  .dito-pagination.dito-buttons-round
    .dito-pages
      template(v-if="total > 0") {{ first }} – {{ last }}
      template(v-else) 0
      |  / {{ total }}
    template(v-if="numPages > 1")
      router-link.dito-button.dito-previous(
        :to="getLink(current - 1)"
        tag="button"
        type="button"
        :class="{ 'dito-hide': current === 1 }"
      )
        +nbsp
      router-link.dito-button.dito-next(
        :to="getLink(current + 1)"
        tag="button"
        type="button"
        :class="{ 'dito-hide': current === numPages }"
      )
        +nbsp
      router-link.dito-button(
        v-for="page in numPages"
        :to="getLink(page)"
        :key="page"
        tag="button"
        type="button"
        :class="{ 'dito-active': page === current }"
      ) {{ page }}
</template>

<style lang="sass">
.dito
  .dito-pagination
    line-height: 2em
    .dito-pages
      display: inline-block
      margin-right: 0.5em
    .dito-button
      line-height: normal
      margin-left: 0.35em
      &.dito-previous::before
        +icon-arrow
        transform: scaleX(-1)
      &.dito-next::before
        +icon-arrow
      &.dito-hide
        visibility: hidden
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-pagination', {
  props: {
    query: { type: Object, required: true },
    limit: { type: Number, required: true },
    total: { type: Number, required: true }
  },

  computed: {
    current() {
      return (+this.query.page || 0) + 1
    },

    first() {
      return (this.current - 1) * this.limit + 1
    },

    last() {
      return Math.min(this.first + this.limit - 1, this.total)
    },

    numPages() {
      return Math.ceil(this.total / this.limit)
    }
  },

  methods: {
    getLink(page) {
      page = Math.min(Math.max(page, 1), this.numPages)
      return {
        query: { ...this.query, page: (page - 1) },
        hash: this.$route.hash
      }
    }
  }
})
</script>
