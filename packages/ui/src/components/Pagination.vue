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
    ul.dito-pagination-items
      li(
        v-for="page in pageRange"
      )
        button.dito-button.dito-pagination-item(
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
    .dito-pagination-items
      display: flex
      padding: 0
      li
        list-style: none
      .dito-pagination-item
        display: block
        transition: all .3s ease, color 0s, background 0s, border 0s
        font-variant-numeric: tabular-nums
        +user-select(none)
        height: 2em
        min-width: 2em
        padding: 0 0.5em
        text-align: center
        margin: 0 $button-margin
        border-radius: 1em
        &.dito-active
          background: $color-active
          color: $color-text-inverted
          &:active
            border-color: darken($color-active, 10%)
        &-prev::before
          +icon-arrow
          transform: scaleX(-1)
        &-next::before
          +icon-arrow
        &-ellipsis-prev,
        &-ellipsis-next
          &::before
            +icon-ellipsis
          background: none
          border: 0
          padding: 0
          margin: 0
          color: $color-text
          &:focus
            color: $color-active
          &:active
            box-shadow: none
        &-ellipsis-prev:hover::before
          +icon-arrow-double
          transform: scaleX(-1)
        &-ellipsis-next:hover::before
          +icon-arrow-double
</style>

<script>
export default {
  props: {
    total: {
      type: Number,
      default: 0
    },
    page: {
      type: Number,
      default: 1
    },
    pageSize: {
      type: Number,
      default: 10
    },
    showTotal: {
      type: Boolean,
      default: true
    }
  },

  data() {
    return {
      pageRange: [],
      showPrev: true,
      showNext: true,
      numPages: 0,
      currPageSize: this.pageSize,
      currPage: this.page
    }
  },

  computed: {
    first() {
      return (this.currPage - 1) * this.currPageSize + 1
    },

    last() {
      return Math.min(this.first + this.currPageSize - 1, this.total)
    }
  },

  watch: {
    total: 'updatePageRange',
    showPrev: 'updatePageRange',
    showNext: 'updatePageRange',

    page(page) {
      this.currPage = page
    },

    pageSize(pageSize) {
      this.currPageSize = pageSize
    },

    currPageSize(currPageSize) {
      this.numPages = Math.ceil(this.total / currPageSize)
      if (this.currPage > this.numPages) {
        this.currPage = this.numPages
      }
      this.updatePageRange()
      this.$emit('size-change', this.page, currPageSize)
    },

    currPage(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.updatePageRange()
        this.$emit('update:page', newVal)
      }
    }
  },

  created() {
    this.currPage = this.page
    this.currPageSize = this.pageSize
  },

  mounted() {
    this.updatePageRange()
  },

  methods: {
    onClickPage(page) {
      if (page.index && !page.disabled && page.index !== this.currPage) {
        this.currPage = page.index
      }
    },

    getPageClass(page) {
      const classes = {
        'dito-active': page.active
      }
      if (page.type) {
        classes[`dito-pagination-item-${page.type}`] = true
      }
      return classes
    },

    updatePageRange() {
      const { showPrev, showNext, total, currPageSize, currPage } = this
      const showLen = showPrev + showNext + 1
      const numPages = this.numPages = Math.ceil(total / currPageSize)

      let start = 0
      let end = 0
      if (numPages <= 1) {
        start = end = 1
      } else if (numPages <= showLen) {
        start = 1
        end = numPages
      } else {
        if (currPage <= showPrev + 1) {
          start = 1
          end = showLen
        } else if (currPage >= numPages - showNext) {
          end = numPages
          start = numPages - showLen + 1
        } else {
          start = currPage - showPrev
          end = currPage + showNext
        }
      }

      const pageRange = []
      pageRange.push({
        index: currPage - 1,
        type: 'prev',
        disabled: currPage <= 1
      })
      if (start >= 2) {
        pageRange.push({ index: 1, text: 1 })
      }
      if (start > 2) {
        pageRange.push({
          index: Math.max(1, currPage - 10),
          type: 'ellipsis-prev'
        })
      }
      for (let i = start; i <= end; i++) {
        pageRange.push({
          index: i,
          text: i,
          active: i === currPage
        })
      }
      if (end < numPages - 1) {
        pageRange.push({
          index: Math.min(numPages, currPage + 10),
          type: 'ellipsis-next'
        })
      }
      if (end <= numPages - 1) {
        pageRange.push({ index: numPages, text: numPages })
      }
      pageRange.push({
        index: currPage + 1,
        type: 'next',
        disabled: currPage >= numPages
      })

      this.pageRange = pageRange
    }
  }
}
</script>
