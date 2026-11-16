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
    PaginationPrev.dito-button.dito-pagination__prev
      DitoIcon(name="arrow")
    template(
      v-for="(item, index) in items"
      :key="index"
    )
      PaginationListItem.dito-button(
        v-if="item.type === 'page'"
        :value="item.value"
      )
      PaginationEllipsis.dito-pagination__ellipsis(
        v-else
        as="span"
      )
        DitoIcon(name="ellipsis")
    PaginationNext.dito-button
      DitoIcon(name="arrow")
</template>

<script>
import {
  PaginationEllipsis,
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
    PaginationEllipsis,
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
  }

  &__prev .dito-icon {
    transform: scaleX(-1);
  }

  &__ellipsis {
    display: flex;
    align-items: center;
  }
}
</style>
