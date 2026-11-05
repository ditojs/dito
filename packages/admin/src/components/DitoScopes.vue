<template lang="pug">
.dito-scopes
  DitoButton(
    v-for="(scope, key) in scopes"
    :key="key"
    :class="{ 'dito-button--selected': scope.name === listQuery.query.scope }"
    :aria-pressed="scope.name === listQuery.query.scope"
    :title="scope.hint || getLabelText(scope)"
    @click="selectScope(scope)"
  ) {{ getLabelText(scope) }}
</template>

<script>
import { DitoButton } from '@ditojs/ui/src'
import { useSchemaValue } from '../composables/useSchemaValue.ts'

export default {
  components: { DitoButton },

  props: {
    listQuery: { type: Object, required: true },
    scopes: { type: Object, required: true },
    // The context of the list, for the callbacks of the scopes:
    context: { type: Object, required: true }
  },

  setup(props) {
    return {
      getLabelText: useSchemaValue(props.context).getLabelText,

      selectScope(scope) {
        props.listQuery.update({ scope: scope.name }, { resetPage: true })
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-scopes {
  white-space: nowrap;
  display: flex;
  // Scroll the scopes that don't fit, with room for the focus ring:
  overflow-x: auto;
  padding: $border-width;
  margin: -$border-width;

  .dito-button {
    border-radius: 0;
    flex: 0 0 auto;

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
    }

    // Don't cover the focused border of buttons:
    &:focus {
      z-index: 1;
    }
  }
}
</style>
