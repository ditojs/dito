<template lang="pug">
Pagination(
  v-model:page="page"
  :pageSize="limit"
  :total="total"
)
</template>

<script>
import { Pagination } from '@ditojs/ui/src'
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoPagination', {
  components: { Pagination },

  props: {
    query: { type: Object, required: true },
    limit: { type: Number, required: true },
    total: { type: Number, required: true }
  },

  computed: {
    page: {
      get() {
        return (+this.query.page || 0) + 1
      },

      set(page) {
        if (this.page !== page) {
          this.$router.push(
            this.getQueryLink({
              ...this.query,
              page: page - 1
            })
          )
        }
      }
    }
  }
})
</script>
