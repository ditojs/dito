<template lang="pug">
.dito-affixes(
  v-if="hasContent()"
  :class="classes"
)
  slot(name="prepend")
  DitoAffix.dito-affix(
    v-for="(item, index) in visibleItems"
    :key="index"
    :class="getItemClasses(item)"
    :style="item.style"
    :item="item"
  )
  button.dito-affixes__clear(
    v-if="shouldShowClearButton"
    type="button"
    title="Clear"
    :disabled="disabled"
    @click.stop="$emit('clear')"
    @mousedown.stop
  )
  slot(name="append")
  .dito-info(
    v-if="inlineInfo"
    :data-info="inlineInfo"
  )
</template>

<script>
import { computed } from 'vue'
import { asArray, isString } from '@ditojs/utils'
import { hasSlotContent } from '@ditojs/ui/src'
import DitoAffix from './DitoAffix.vue'
import { shouldRenderSchema } from '../utils/schema/data.js'

export default {
  name: 'DitoAffixes',
  components: { DitoAffix },
  emits: ['clear'],

  props: {
    items: { type: [String, Object, Array], default: null },
    mode: { type: String, default: null },
    position: { type: String, default: null },
    absolute: { type: Boolean, default: false },
    // The clear button only shows when both are true:
    clearable: { type: Boolean, default: false },
    hasValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    inlineInfo: { type: String, default: null },
    // For the callbacks of the items:
    parentContext: { type: Object, required: true }
  },

  setup(props, { slots }) {
    const visibleItems = computed(() =>
      asArray(props.items)
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
        .filter(item => shouldRenderSchema(item, props.parentContext))
    )

    const shouldShowClearButton = computed(
      () => props.clearable && props.hasValue
    )

    return {
      visibleItems,
      shouldShowClearButton,

      classes: computed(() => {
        const prefix = 'dito-affixes'
        return {
          [`${prefix}--${props.position}`]: props.position,
          [`${prefix}--${props.mode}`]: props.mode,
          [`${prefix}--absolute`]: props.absolute
        }
      }),

      // Called in the template, as the slots aren't reactive:
      hasContent() {
        return (
          visibleItems.value.length > 0 ||
          shouldShowClearButton.value ||
          !!props.inlineInfo ||
          hasSlotContent(slots.prepend) ||
          hasSlotContent(slots.append)
        )
      },

      getItemClasses(item) {
        const prefix = 'dito-affix'
        return [
          {
            [`${prefix}--${item.type}`]: item.type,
            [`${prefix}--ellipsis`]: (
              props.mode === 'ellipsis' &&
              ['text', 'html'].includes(item.type)
            )
          },
          item.class
        ]
      }
    }
  }
}
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

  &--ellipsis {
    flex: 1;
  }

  &--input {
    color: $color-grey;

    .dito-icon--disabled {
      color: $color-light;
    }

    @at-root .dito-component:not(:has(.dito-component)):focus-within & {
      color: $color-active;
    }
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

    // Only show when hovering the component itself, not its open popup, e.g.
    // the color picker.
    @at-root .dito-component:not(:has(.dito-component, .dito-popup:hover)):hover
        & {
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
  @at-root .dito-component:hover:not(:has(.dito-component, .dito-popup:hover))
        #{$self}:has(#{$self}__clear) > *:not(#{$self}__clear) {
      display: none;
    }
}
</style>
