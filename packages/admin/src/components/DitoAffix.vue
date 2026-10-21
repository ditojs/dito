<template lang="pug">
//- Deprecated `type: 'html'` affixes render their `html` like text affixes:
component(
  v-if="item.type === 'text' || item.type === 'html'"
  :is="item.as || 'div'"
  v-html="getHtml(item)"
)
DitoSpinner(
  v-else-if="item.type === 'spinner'"
  :size="item.size"
  :color="item.color"
)
DitoIcon(
  v-else-if="item.type === 'icon'"
  :name="item.name"
  :disabled="item.disabled"
)
component(
  v-else-if="item.type === 'component'"
  :is="item.component"
  v-bind="item.props"
)
</template>

<script>
import DitoSpinner from './DitoSpinner.vue'
import { DitoIcon } from '@ditojs/ui/src'
import { getHtml } from '../utils/html.js'

export default {
  components: { DitoSpinner, DitoIcon },

  props: {
    item: { type: Object, required: true }
  },

  setup() {
    return { getHtml }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-affix {
  &--html,
  &--text {
    display: inline-block;
  }

  &--ellipsis {
    @include ellipsis;

    flex: 1;
    display: block;
    min-width: 0;
    width: 0;
  }
}
</style>
