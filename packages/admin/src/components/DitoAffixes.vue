<template lang="pug">
.dito-affixes(
  v-if="hasContent"
  :class="classes"
)
  slot(name="prepend")
  DitoAffix.dito-affix(
    v-for="(item, index) in visibleItems"
    :key="index"
    :class="[`dito-affix--${item.type}`, item.class]"
    :style="item.style"
    :item="item"
    :parentContext="parentContext"
  )
  button.dito-affixes__clear(
    v-if="clearable"
    type="button"
    title="Clear"
    :disabled="disabled"
    @click.stop="$emit('clear')"
    @mousedown.stop
  )
  slot(name="append")
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import DitoAffix from './DitoAffix.vue'
import { asArray, isString } from '@ditojs/utils'
import { hasSlotContent } from '@ditojs/ui/src'
import { shouldRenderSchema } from '../utils/schema.js'

export default DitoComponent.component('DitoAffixes', {
  components: { DitoAffix },
  emits: ['clear'],

  props: {
    items: { type: [String, Object, Array], default: null },
    position: { type: String, default: null },
    absolute: { type: Boolean, default: false },
    clearable: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
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
    },

    classes() {
      const prefix = 'dito-affixes'
      return {
        [`${prefix}--${this.position}`]: this.position,
        [`${prefix}--absolute`]: this.absolute
      }
    },

    hasContent() {
      return (
        this.visibleItems.length > 0 ||
        this.clearable ||
        hasSlotContent(this.$slots.prepend) ||
        hasSlotContent(this.$slots.append)
      )
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-affixes {
  $self: &;

  @include user-select(none);

  display: flex;
  align-items: center;
  gap: $input-padding-hor;

  &--absolute {
    position: absolute;
    inset: $border-width;
    margin: $input-padding-ver $input-padding-hor;
    pointer-events: none;

    > * {
      pointer-events: auto;
    }

    &#{$self}--prefix {
      right: unset;
    }

    &#{$self}--suffix {
      left: unset;
    }
  }

  @at-root .dito-component & {
    color: $color-grey;

    .dito-icon--disabled {
      color: $color-light;
    }
  }

  @at-root .dito-component:focus-within:not(:has(.dito-component)) & {
    color: $color-active;
  }

  &__clear {
    --size: #{calc($input-height - 4 * $border-width)};

    display: none;
    position: relative;
    cursor: pointer;
    width: var(--size);
    height: var(--size);
    border-radius: $border-radius;
    margin: (-$input-padding-ver + $border-width)
      (-$input-padding-hor + $border-width);
    padding: 0;
    border: 0;

    @at-root .dito-component:hover:not(:has(.dito-component)) & {
      display: block;
    }

    &::before {
      @extend %icon-clear;

      color: $color-grey;
    }

    &:hover::before {
      color: $color-black;
    }
  }

  // Hide other affixes when clear button is shown
  // prettier-ignore
  @at-root .dito-component:hover:not(:has(.dito-component))
        #{$self}:has(#{$self}__clear) > *:not(#{$self}__clear) {
      display: none;
    }
}
</style>
