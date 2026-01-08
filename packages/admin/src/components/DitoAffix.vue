<template lang="pug">
component(
  v-if="item.type === 'text'"
  :is="item.as || 'span'"
) {{ item.text }}
component(
  v-else-if="item.type === 'html'"
  :is="item.as || 'span'"
  v-html="item.html"
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
import DitoComponent from '../DitoComponent.js'
import DitoSpinner from './DitoSpinner.vue'
import { DitoIcon } from '@ditojs/ui/src'

export default DitoComponent.component('DitoAffix', {
  components: { DitoSpinner, DitoIcon },

  props: {
    item: { type: Object, required: true },
    parentContext: { type: Object, required: true }
  },

  computed: {
    // Override DitoMixin's context with the parent's context
    context() {
      return this.parentContext
    }
  }
})
</script>

<style lang="scss">
.dito-affix {
  &--text {
    display: inline-block;
  }
}
</style>
