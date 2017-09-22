<template lang="pug">
  mixin nbsp
    | !{' '}
  .dito-pagination.dito-buttons-round
    .dito-pages
      template(v-if="count > 0") {{ first }} – {{ last }}
      template(v-else) 0
      |  / {{ count }}
    template(v-if="pages > 1")
      router-link.dito-button.dito-previous(
        :to="{ query: getQuery(current - 1) }"
        tag="button"
        type="button"
        :class="{ 'dito-hide': current === 1 }"
      )
        +nbsp
      router-link.dito-button.dito-next(
        :to="{ query: getQuery(current + 1) }"
        tag="button"
        type="button"
        :class="{ 'dito-hide': current === pages }"
      )
        +nbsp
      router-link.dito-button(
        v-for="page in pages"
        :to="{ query: getQuery(page) }"
        :key="`page_{page}`"
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
      page = Math.min(Math.max(page, 1), this.pages)
      return { ...this.filter, offset: (page - 1) * this.limit }
    }
  }
})
</script>
