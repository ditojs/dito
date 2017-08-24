<template lang="pug">
  .dito-scopes
    router-link.dito-button(
      v-for="scope in scopes"
      :to="{ query: getQuery(scope) }"
      :key="scope.name"
      tag="button"
      type="button"
      :class="{ 'dito-active': scope.name === filter.scope }"
    )
      | {{ scope.label }}
</template>

<style lang="sass">
.dito
  .dito-scopes
    // font-size: 0.9em
    .dito-button
      border-radius: 0
      &:first-child
        border-top-left-radius: 1em
        border-bottom-left-radius: 1em
        padding-left: 1em
        padding-right: 1em
      &:last-child
        border-top-right-radius: 1em
        border-bottom-right-radius: 1em
        border-left: $border-style
        &:focus
          border-left-color: $color-active
        &:active
          border-left-color: $button-color-active-border
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-scopes', {
  props: {
    filter: { type: Object, required: true },
    scopes: { type: Array, required: true }
  },

  methods: {
    getQuery(scope) {
      const query = { ...this.filter, scope: scope.name }
      if (query.offset) {
        query.offset = 0
      }
      return query
    }
  }
})
</script>
