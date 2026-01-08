<template lang="pug">
.dito-affixes(
  v-if="visibleItems.length > 0"
)
  DitoAffix.dito-affix(
    v-for="(item, index) in visibleItems"
    :key="index"
    :class="[`dito-affix--${item.type}`, item.class]"
    :style="item.style"
    :item="item"
    :parentContext="parentContext"
  )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import DitoAffix from './DitoAffix.vue'
import { asArray, isString } from '@ditojs/utils'
import { shouldRenderSchema } from '../utils/schema.js'

export default DitoComponent.component('DitoAffixes', {
  components: { DitoAffix },

  props: {
    items: { type: [String, Object, Array], default: null },
    parentContext: { type: Object, required: true }
  },

  computed: {
    // Override DitoMixin's context with the parent's context
    context() {
      return this.parentContext
    },

    processedItems() {
      return asArray(this.items)
        .filter(Boolean)
        .map(item =>
          isString(item)
            ? { type: 'text', text: item }
            : item.type
              ? item
              : item.text != null
                ? { type: 'text', ...item }
                : item.html != null
                  ? { type: 'html', ...item }
                  : item
        )
    },

    visibleItems() {
      return this.processedItems.filter(item =>
        shouldRenderSchema(item, this.context)
      )
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-affixes {
  @include user-select(none);

  display: flex;
  align-items: center;
  gap: $input-padding-hor;

  @at-root .dito-input & {
    color: $color-grey;

    .dito-icon--disabled {
      color: $color-light;
    }
  }

  @at-root .dito-input:focus-within & {
    color: $color-active;
  }
}
</style>
