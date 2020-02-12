<template lang="pug">
  pagination(
    :pageSize="limit"
    :total="total"
    :page.sync="page"
  )
</template>

<script>
import DitoComponent from '@/DitoComponent'
import { Pagination } from '@ditojs/ui'

// @vue/component
export default DitoComponent.component('dito-pagination', {
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
          this.$router.push(this.getQueryLink({
            ...this.query,
            page: (page - 1)
          }))
        }
      }
    }
  }
})
</script>
