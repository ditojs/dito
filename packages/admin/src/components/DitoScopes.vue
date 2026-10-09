<template lang="pug">
.dito-scopes
  DitoButton(
    v-for="(scope, key) in scopes"
    :key="key"
    :class="{ 'dito-button--selected': scope.name === query.scope }"
    :aria-pressed="scope.name === query.scope"
    :title="scope.hint || getLabel(scope)"
    @click="selectScope(scope)"
  ) {{ getLabel(scope) }}
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { DitoButton } from '@ditojs/ui/src'

// @vue/component
export default DitoComponent.component('DitoScopes', {
  components: { DitoButton },

  props: {
    query: { type: Object, required: true },
    scopes: { type: Object, required: true }
  },

  methods: {
    selectScope(scope) {
      this.sourceComponent.listQuery.update(
        { scope: scope.name },
        { resetPage: true }
      )
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-scopes {
  white-space: nowrap;
  display: flex;

  .dito-button {
    @include ellipsis;

    border-radius: 0;
    // A bit more than the width of ellipsis, to prevent replacing short words
    // with ellipsis.
    min-width: 3em;
    flex: 0 1 auto;

    &:first-child {
      border-top-left-radius: 1em;
      border-bottom-left-radius: 1em;
      padding-left: 1em;
    }

    &:last-child {
      border-top-right-radius: 1em;
      border-bottom-right-radius: 1em;
      padding-right: 1em;
    }

    & + .dito-button {
      margin-left: -1px;
    } // Don't cover the focused border of buttons:
    &:focus {
      z-index: 1;
    }
  }
}
</style>
