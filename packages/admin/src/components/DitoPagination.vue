<template lang="pug">
Pagination(
  v-model:page="page"
  :pageSize="limit"
  :total="total"
)
</template>

<script>
import { computed } from 'vue'
import { DitoPagination as Pagination } from '@ditojs/ui/src'

export default {
  components: { Pagination },

  props: {
    listQuery: { type: Object, required: true },
    limit: { type: Number, required: true },
    total: { type: Number, required: true }
  },

  setup(props) {
    return {
      page: computed({
        get() {
          return (+props.listQuery.query.page || 0) + 1
        },

        set(page) {
          props.listQuery.update({ page: page - 1 })
        }
      })
    }
  }
}
</script>
