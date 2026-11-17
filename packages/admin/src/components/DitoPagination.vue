<template lang="pug">
Pagination(
  v-model:page="page"
  :pageSize="table.atoms.pagination.get().pageSize"
  :total="table.getRowCount()"
)
</template>

<script>
import { computed } from 'vue'
import { DitoPagination as Pagination } from '@ditojs/ui/src'

export default {
  components: { Pagination },

  props: {
    table: { type: Object, required: true }
  },

  setup(props) {
    return {
      page: computed({
        get() {
          return props.table.atoms.pagination.get().pageIndex + 1
        },

        set(page) {
          props.table.setPageIndex(page - 1)
        }
      })
    }
  }
}
</script>
