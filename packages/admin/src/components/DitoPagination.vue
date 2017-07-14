<template lang="pug">
  .dito-pagination
    .dito-pages {{ first }} – {{ last }} / {{ count }}
    template(v-if="pages > 1")
      router-link.dito-button.dito-previous(
        v-if="current > 1"
        :to="{ query: getQuery(current - 1) }"
        tag="button"
        type="button"
      )
        | &nbsp;
        .dito-arrow
      router-link.dito-button.dito-next(
        v-if="current < pages"
        :to="{ query: getQuery(current + 1) }"
        tag="button"
        type="button"
      )
        | &nbsp;
        .dito-arrow
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
$arrow-size: 6px

.dito
  .dito-pagination
    .dito-pages
      display: inline-block
      margin-right: 0.5em
    .dito-button
      display: inline-block
      width: 2em
      margin-left: 0.35em
      border-radius: 1em
      text-align: center
      &.dito-previous .dito-arrow
        +arrow($arrow-size, 'left')
        border-color: $color-text
        margin-left: 2px
      &.dito-next .dito-arrow
        +arrow($arrow-size, 'right')
        border-color: $color-text
        margin-right: 2px
    // display: inline
    // line-height: 0
    // font-size: 1.3em
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
