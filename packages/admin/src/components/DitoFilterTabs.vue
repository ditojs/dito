<template lang="pug">
.dito-filter-tabs
  DitoButton(
    v-for="(tab, key) in tabs"
    :key="key"
    :class="{ 'dito-button--selected': tab === selectedTab }"
    :aria-pressed="tab === selectedTab"
    :title="tab.hint || getLabelText(tab)"
    @click="selectTab(tab)"
  ) {{ getLabelText(tab) }}
</template>

<script>
import { computed } from 'vue'
import { DitoButton } from '@ditojs/ui/src'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { clearTabs, getSelectedTab, getTabQuery } from '../utils/filter.js'

export default {
  components: { DitoButton },

  props: {
    listQuery: { type: Object, required: true },
    tabs: { type: Object, required: true },
    // The context of the list, for the callbacks of the tabs:
    context: { type: Object, required: true }
  },

  setup(props) {
    return {
      getLabelText: useSchemaValue(props.context).getLabelText,

      selectedTab: computed(() =>
        getSelectedTab(props.tabs, props.listQuery.query)
      ),

      selectTab(tab) {
        props.listQuery.update(
          { ...clearTabs(props.tabs), ...getTabQuery(tab) },
          { resetPage: true }
        )
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-filter-tabs {
  white-space: nowrap;
  display: flex;
  // Scroll the tabs that don't fit, with room for the focus ring:
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
