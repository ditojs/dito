<template lang="pug">
  .dito-scopes
    router-link.dito-button(
      v-for="scope in scopes"
      :to="{ query: getQuery(scope) }"
      :key="scope.name"
      tag="button"
      type="button"
      :class="{ 'dito-selected': scope.name === query.scope }"
    )
      | {{ getLabel(scope) }}
</template>

<style lang="sass">
.dito
  .dito-scopes
    white-space: nowrap
    .dito-button
      border-radius: 0
      &:first-child
        border-top-left-radius: 1em
        border-bottom-left-radius: 1em
        padding-left: 1em
      &:last-child
        border-top-right-radius: 1em
        border-bottom-right-radius: 1em
        padding-right: 1em
      & + .dito-button
        border-left: $border-style
        &:focus
          border-left-color: $color-active
        &:active
          border-left-color: $button-color-active-border
</style>

<script>
import DitoComponent from '@/DitoComponent'

// @vue/component
export default DitoComponent.component('dito-scopes', {
  props: {
    query: { type: Object, required: true },
    scopes: { type: Object, required: true }
  },

  methods: {
    getQuery(scope) {
      const query = { ...this.query, scope: scope.name }
      if (query.page) {
        query.page = 0
      }
      return query
    }
  }
})
</script>
