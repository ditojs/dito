<template lang="pug">
  .dito-filters.dito-panels
    .dito-panel
      .dito-filters-title.dito-panel-title
      form(
        @submit.prevent="applyFilters(false)"
      )
        dito-schema.dito-panel-schema(
          ref="filtersSchema"
          :schema="filtersSchema"
          :data="filtersData"
        )
          .dito-buttons(slot="buttons")
            button.dito-button.dito-button-clear(
              type="button"
              @click="clearFilters"
            )
            button.dito-button.dito-button-filter(
              type="submit"
            )
</template>

<style lang="sass">
.dito
  .dito-filters
    position: absolute
    left: $content-width
    width: 240px
    .dito-filters-title
      &::before
        content: 'Filters'
</style>

<script>
import DitoComponent from '@/DitoComponent'
import {
  getFiltersPanel, getFiltersData, getFiltersQuery
} from '@/utils/filter'

// @vue/component
export default DitoComponent.component('dito-filters', {
  $_veeValidate: {
    // DitoFilters needs a separate $errors object:
    validator: 'new'
  },

  props: {
    filters: {
      type: Object,
      required: true
    },
    query: {
      type: Object,
      required: true
    }
  },

  data() {
    return {
      filtersData: {}
    }
  },

  computed: {
    filtersSchema() {
      return getFiltersPanel(this.filters)
    }
  },

  watch: {
    query() {
      this.setupFiltersData(this.query)
    },

    filtersSchema() {
      this.setupFiltersData(this.query)
    }
  },

  mounted() {
    this.setupFiltersData(this.query)
  },

  methods: {
    setupFiltersData(query) {
      this.filtersData = getFiltersData(this.filtersSchema, query)
    },

    clearFilters() {
      this.setupFiltersData()
      this.$refs.filtersSchema.clearErrors()
      this.applyFilters(true)
    },

    applyFilters(clear) {
      const filter = getFiltersQuery(this.filtersSchema, this.filtersData)
      const query = {
        ...this.query,
        filter
      }
      if (!clear) {
        // Reset pagination when applying new filters:
        query.page = undefined
      }
      this.$router.push({
        query,
        hash: this.$route.hash
      })
    },

    showErrors(errors, focus) {
      this.$refs.filtersSchema.showErrors(errors, focus)
    }
  }
})
</script>
