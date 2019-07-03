<template lang="pug">
  .dito-pagination(
    v-if="numPages > 1"
  )
    .dito-pagination-total(
      v-if="showTotal"
    )
      template(v-if="total > 0") {{ first }} – {{ last }}
      template(v-else) 0
      |  / {{ total }}
    .dito-buttons.dito-buttons-round
      button.dito-button(
        v-for="page in pageRange"
        @click="onClickPage(page)"
        :class="getPageClass(page)"
        :disabled="page.disabled"
      )
        span(
          v-if="page.text"
        ) {{ page.text }}
</template>

<style lang="sass">
  .dito-pagination
    display: flex
    .dito-pagination-total
      white-space: nowrap
      margin: 0 0.5em
      line-height: 2em
      overflow: hidden
      text-overflow: ellipsis
    .dito-button
      transition: all .3s ease, color 0s, background 0s, border 0s
      font-variant-numeric: tabular-nums
      padding: 0 0.5em
      &.dito-active
        background: $color-active
        color: $color-text-inverted
        &:active
          border-color: darken($color-active, 10%)
      &-prev,
      &-next
        &::before
          @extend %icon-arrow
      &-prev::before
        transform: scaleX(-1)
      &-ellipsis-prev,
      &-ellipsis-next
        &::before
          @extend %icon-ellipsis
        &:hover::before
          @extend %icon-chevrons
        background: none
        border: 0
        padding: 0
        margin: 0
        color: $color-text
        &:focus
          color: $color-active
        &:active
          box-shadow: none
      &-ellipsis-prev::before
        transform: scaleX(-1)
</style>

<script>
export default {
  props: {
    total: { type: Number, default: 0 },
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 10 },
    showTotal: { type: Boolean, default: true }
  },

  data() {
    return {
      pageRange: [],
      showPrev: true,
      showNext: true,
      numPages: 0,
      currentPageSize: this.pageSize,
      currentPage: this.page
    }
  },

  computed: {
    first() {
      return (this.currentPage - 1) * this.currentPageSize + 1
    },

    last() {
      return Math.min(this.first + this.currentPageSize - 1, this.total)
    }
  },

  watch: {
    total: 'updatePageRange',
    showPrev: 'updatePageRange',
    showNext: 'updatePageRange',

    page(page) {
      this.currentPage = page
    },

    pageSize(pageSize) {
      this.currentPageSize = pageSize
    },

    currentPageSize(currentPageSize) {
      this.numPages = Math.ceil(this.total / currentPageSize)
      if (this.currentPage > this.numPages) {
        this.currentPage = this.numPages
      }
      this.updatePageRange()
      this.$emit('size-change', this.page, currentPageSize)
    },

    currentPage(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.updatePageRange()
        this.$emit('update:page', newVal)
      }
    }
  },

  created() {
    this.currentPage = this.page
    this.currentPageSize = this.pageSize
  },

  mounted() {
    this.updatePageRange()
  },

  methods: {
    onClickPage(page) {
      if (page.index && !page.disabled && page.index !== this.currentPage) {
        this.currentPage = page.index
      }
    },

    getPageClass(page) {
      const classes = {
        'dito-active': page.active
      }
      if (page.type) {
        classes[`dito-button-${page.type}`] = true
      }
      return classes
    },

    updatePageRange() {
      const { showPrev, showNext, total, currentPageSize, currentPage } = this
      const showLen = showPrev + showNext + 1
      const numPages = this.numPages = Math.ceil(total / currentPageSize)

      let start = 0
      let end = 0
      if (numPages <= 1) {
        start = end = 1
      } else if (numPages <= showLen) {
        start = 1
        end = numPages
      } else {
        if (currentPage <= showPrev + 1) {
          start = 1
          end = showLen
        } else if (currentPage >= numPages - showNext) {
          end = numPages
          start = numPages - showLen + 1
        } else {
          start = currentPage - showPrev
          end = currentPage + showNext
        }
      }

      const pageRange = []
      pageRange.push({
        index: currentPage - 1,
        type: 'prev',
        disabled: currentPage <= 1
      })
      if (start >= 2) {
        pageRange.push({ index: 1, text: 1 })
      }
      if (start > 2) {
        pageRange.push({
          index: Math.max(1, currentPage - 10),
          type: 'ellipsis-prev'
        })
      }
      for (let i = start; i <= end; i++) {
        pageRange.push({
          index: i,
          text: i,
          active: i === currentPage
        })
      }
      if (end < numPages - 1) {
        pageRange.push({
          index: Math.min(numPages, currentPage + 10),
          type: 'ellipsis-next'
        })
      }
      if (end <= numPages - 1) {
        pageRange.push({ index: numPages, text: numPages })
      }
      pageRange.push({
        index: currentPage + 1,
        type: 'next',
        disabled: currentPage >= numPages
      })

      this.pageRange = pageRange
    }
  }
}
</script>
