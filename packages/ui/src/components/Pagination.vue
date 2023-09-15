<!-- eslint-disable vue/no-template-shadow -->
<template lang="pug">
.dito-pagination
  .dito-pagination-total(
    v-if="showTotal"
  )
    template(
      v-if="total > 0"
    ) {{ first }} – {{ last }} / {{ total }}
  .dito-buttons.dito-buttons-round(
    v-if="numPages > 1"
  )
    button.dito-button(
      v-for="button in buttons"
      :class="getButtonClasses(button)"
      :disabled="button.disabled"
      @click="onClickButton(button)"
    )
      span(
        v-if="button.text"
      ) {{ button.text }}
</template>

<script>
export default {
  emits: ['update:page'],

  props: {
    total: { type: Number, default: 0 },
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 10 },
    showTotal: { type: Boolean, default: true }
  },

  data() {
    return {
      showPrev: true,
      showNext: true,
      currentPage: this.page
    }
  },

  computed: {
    first() {
      return (this.currentPage - 1) * this.pageSize + 1
    },

    last() {
      return Math.min(this.first + this.pageSize - 1, this.total)
    },

    numPages() {
      return Math.ceil(this.total / this.pageSize)
    },

    buttons() {
      const { showPrev, showNext, currentPage, numPages } = this
      const showLength = showPrev + showNext + 1

      let start = 1
      let end = 1
      if (numPages <= showLength) {
        end = numPages
      } else if (currentPage <= showPrev + 1) {
        end = showLength
      } else if (currentPage >= numPages - showNext) {
        end = numPages
        start = numPages - showLength + 1
      } else {
        start = currentPage - showPrev
        end = currentPage + showNext
      }

      const buttons = []
      buttons.push({
        index: currentPage - 1,
        type: 'prev',
        disabled: currentPage <= 1
      })
      if (start >= 2) {
        buttons.push({ index: 1, text: 1 })
      }
      if (start > 2) {
        buttons.push({
          index: Math.max(1, currentPage - 10),
          type: 'ellipsis-prev'
        })
      }
      for (let i = start; i <= end; i++) {
        buttons.push({
          index: i,
          text: i,
          active: i === currentPage
        })
      }
      if (end < numPages - 1) {
        buttons.push({
          index: Math.min(numPages, currentPage + 10),
          type: 'ellipsis-next'
        })
      }
      if (end <= numPages - 1) {
        buttons.push({ index: numPages, text: numPages })
      }
      buttons.push({
        index: currentPage + 1,
        type: 'next',
        disabled: currentPage >= numPages
      })

      return buttons
    }
  },

  watch: {
    page(page) {
      this.currentPage = page
    },

    pageSize() {
      if (this.currentPage > this.numPages) {
        this.currentPage = this.numPages
      }
    },

    currentPage(to, from) {
      if (to !== from) {
        this.$emit('update:page', to)
      }
    }
  },

  created() {
    this.currentPage = this.page
  },

  methods: {
    getButtonClasses(button) {
      const classes = {
        'dito-selected': button.active
      }
      if (button.type) {
        classes[`dito-button-${button.type}`] = true
      }
      return classes
    },

    onClickButton(button) {
      if (
        button.index &&
        !button.disabled &&
        button.index !== this.currentPage
      ) {
        this.currentPage = button.index
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-pagination {
  display: flex;

  .dito-pagination-total {
    @include ellipsis;

    margin: 0 0.5em;
    line-height: $input-height;
  }

  .dito-button {
    transition:
      all 0.3s ease,
      color 0s,
      background 0s,
      border 0s;
    font-variant-numeric: tabular-nums;
    padding: 0 0.5em;

    &-prev,
    &-next {
      &::before {
        @extend %icon-arrow;
      }
    }

    &-prev::before {
      transform: scaleX(-1);
    }

    &-ellipsis-prev,
    &-ellipsis-next {
      &::before {
        @extend %icon-ellipsis;
      }

      &:hover::before {
        @extend %icon-chevrons;
      }

      background: none;
      border: 0;
      padding: 0;
      margin: 0;
      color: $color-text;

      &:focus {
        color: $color-active;
      }

      &:active {
        box-shadow: none;
      }
    }

    &-ellipsis-prev::before {
      transform: scaleX(-1);
    }
  }
}
</style>
