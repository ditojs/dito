<template lang="pug">
  .dito-scopes
    router-link.dito-button(
      v-for="(scope, key) in scopes"
      :key="key"
      :to="getLink(scope)"
      tag="button"
      type="button"
      :class="{ 'dito-selected': scope.name === query.scope }"
      :title="getLabel(scope)"
    )
      | {{ getLabel(scope) }}
</template>

<style lang="sass">
  .dito-scopes
    white-space: nowrap
    display: flex
    .dito-button
      +ellipsis
      border-radius: 0
      // A bit more than the width of ellipsis, to prevent replacing short words
      // with ellipsis.
      min-width: 3em
      flex: 0 1 auto
      &:first-child
        border-top-left-radius: 1em
        border-bottom-left-radius: 1em
        padding-left: 1em
      &:last-child
        border-top-right-radius: 1em
        border-bottom-right-radius: 1em
        padding-right: 1em
      & + .dito-button
        margin-left: -1px
      // Don't cover the focused border of buttons:
      &:focus
        z-index: 1
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
    getLink(scope) {
      const query = { ...this.query, scope: scope.name }
      if (query.page) {
        query.page = 0
      }
      // Preserve hash for tabs:
      return { query, hash: this.$route.hash }
    }
  }
})
</script>
