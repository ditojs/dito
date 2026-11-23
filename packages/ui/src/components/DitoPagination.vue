<template lang="pug">
PaginationRoot.dito-pagination(
  v-model:page="currentPage"
  aria-label="Pagination"
  :total="total"
  :itemsPerPage="pageSize"
  :siblingCount="1"
  showEdges
)
  .dito-pagination__total(
    v-if="showTotal"
  )
    template(
      v-if="total > 0"
    ) {{ first }} – {{ last }} / {{ total }}
  PaginationList.dito-buttons.dito-buttons--round(
    v-if="numPages > 1"
    v-slot="{ items }"
  )
    PaginationPrev.dito-button.dito-pagination__prev(
      aria-label="Previous page"
    )
      DitoIcon(name="arrow")
    template(
      v-for="(item, index) in items"
      :key="index"
    )
      PaginationListItem.dito-button(
        v-if="item.type === 'page'"
        :value="item.value"
      )
      //- The ellipses jump ten pages, back before the current page and forward
      //- after it:
      button.dito-pagination__ellipsis(
        v-else
        type="button"
        :class=`{
          'dito-pagination__ellipsis--back':
            getJumpPage(items, index) < currentPage
        }`
        :aria-label="`Page ${getJumpPage(items, index)}`"
        @click="currentPage = getJumpPage(items, index)"
      )
    //- reka-ui only disables the button on the last page, not past it:
    PaginationNext.dito-button.dito-pagination__next(
      aria-label="Next page"
      :disabled="currentPage >= numPages"
    )
      DitoIcon(name="arrow")
</template>

<script>
import {
  PaginationList,
  PaginationListItem,
  PaginationNext,
  PaginationPrev,
  PaginationRoot
} from 'reka-ui'
import DitoIcon from './DitoIcon.vue'

export default {
  components: {
    DitoIcon,
    PaginationList,
    PaginationListItem,
    PaginationNext,
    PaginationPrev,
    PaginationRoot
  },

  emits: ['update:page'],

  props: {
    total: { type: Number, default: 0 },
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 10 },
    showTotal: { type: Boolean, default: true }
  },

  data() {
    return {
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
    }
  },

  watch: {
    page(page) {
      this.currentPage = page
    },

    pageSize() {
      // Without items there are no pages, but page 1 remains valid.
      const lastPage = Math.max(1, this.numPages)
      if (this.currentPage > lastPage) {
        this.currentPage = lastPage
      }
    },

    currentPage(to, from) {
      if (to !== from) {
        this.$emit('update:page', to)
      }
    }
  },

  methods: {
    getJumpPage(items, index) {
      const { currentPage, numPages } = this
      const currentIndex = items.findIndex(({ value }) => value === currentPage)
      return index < currentIndex
        ? Math.max(1, currentPage - 10)
        : Math.min(numPages, currentPage + 10)
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-pagination {
  display: flex;

  &__total {
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

    &[data-selected] {
      @include button-active;
    }

    // As wide as the page buttons, which the padding beside the icon exceeds:
    &.dito-pagination__prev,
    &.dito-pagination__next {
      padding: 0;
    }
  }

  &__prev .dito-icon {
    transform: scaleX(-1);
  }

  &__ellipsis {
    @extend %button--plain;

    position: relative;
    min-width: $input-height;
    min-height: $input-height;

    &::before {
      @extend %icon--ellipsis;
    }

    // Show where the jump goes:
    &:hover::before {
      @extend %icon--chevrons;
    }

    &--back::before {
      transform: scaleX(-1);
    }

    &:focus-visible {
      color: $color-active;
    }
  }
}
</style>
