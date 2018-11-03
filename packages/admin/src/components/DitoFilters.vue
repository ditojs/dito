<template lang="pug">
  .dito-filters
    .dito-filters-title
    form(
      @submit.prevent="applyFilters"
    )
      dito-schema.dito-filters-schema(
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
    left: $content-width + $content-padding
    min-width: 240px
    .dito-filters-title
      &::before
        content: 'Filters'
      height: 2em
      line-height: 2em
      padding: 0 $form-spacing
      background: $button-color
      border-radius: $border-radius
    .dito-filters-schema
      font-size: 11px
      margin-top: 1px
      background: $table-color-background
      border-radius: $border-radius
      padding: 0 $form-spacing
      td
        padding: 0
      .dito-label
        margin: 0
      .dito-components
        margin: 0 (-$form-spacing-half)
      .dito-component-container
        padding: $form-spacing-half
      .dito-buttons
        text-align: right
        padding: $form-spacing 0
</style>

<script>
import DitoComponent from '@/DitoComponent'
import {
  convertFiltersSchema, getFiltersData, getFiltersQuery
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
      return convertFiltersSchema(this.filters)
    }
  },

  watch: {
    query() {
      this.setupFiltersData(true)
    },

    filtersSchema() {
      this.setupFiltersData(false)
    }
  },

  mounted() {
    this.setupFiltersData(true)
  },

  methods: {
    setupFiltersData(restore) {
      this.filtersData = getFiltersData(
        this.filtersSchema,
        restore && this.query
      )
    },

    clearFilters() {
      this.setupFiltersData(false)
      this.$refs.filtersSchema.clearErrors()
      this.applyFilters()
    },

    applyFilters() {
      const filter = getFiltersQuery(this.filtersSchema, this.filtersData)
      this.$router.push({
        query: {
          ...this.query,
          // Reset pagination when applying new filters:
          page: undefined,
          filter
        },
        hash: this.$route.hash
      })
    },

    showErrors(errors, focus) {
      this.$refs.filtersSchema.showErrors(errors, focus)
    }
  }
})
</script>
