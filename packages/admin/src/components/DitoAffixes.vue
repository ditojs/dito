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
    :context="parentContext"
  )
  slot(name="append")
  DitoInfo(
    v-if="inlineInfo"
    :info="inlineInfo"
  )
</template>

<script>
import { computed } from 'vue'
import { asArray, isString, isHtml } from '@ditojs/utils'
import { hasSlotContent } from '@ditojs/ui/src'
import DitoAffix from './DitoAffix.vue'
import DitoInfo from './DitoInfo.vue'
import { shouldRenderSchema } from '../utils/schema/data.js'

export default {
  components: { DitoAffix, DitoInfo },
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
    inlineInfo: { type: [String, Object], default: null },
    // For the callbacks of the items:
    parentContext: { type: Object, required: true }
  },

  setup(props, { slots, emit }) {
    const visibleItems = computed(() => [
      ...asArray(props.items)
        .filter(Boolean)
        .map(item =>
          isString(item) || isHtml(item)
            ? { type: 'text', text: item }
            : item.type
              ? item
              : item.text != null
                ? { type: 'text', ...item }
                : item
        )
        .filter(item => shouldRenderSchema(item, props.parentContext)),
      ...(
        props.clearable && props.hasValue
          ? [
              {
                type: 'button',
                icon: 'clear',
                title: 'Clear',
                hover: true,
                disabled: props.disabled,
                onClick: () => emit('clear')
              }
            ]
          : []
      )
    ])

    return {
      visibleItems,

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
            [`${prefix}--hover`]: item.hover,
            [`${prefix}--ellipsis`]: (
              props.mode === 'ellipsis' &&
              item.type === 'text'
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
  position: relative;
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

  // Hover affixes only show while the component is hovered, in place of the
  // other affixes of their side, overlaying them and the input's padding
  // instead of widening the input:
  > .dito-affix--hover {
    --size: #{calc($input-height - 6 * $border-width)};

    display: none;
    position: absolute;
    right: 0;
    align-items: center;
    justify-content: center;
    min-width: var(--size);
    height: var(--size);
    padding: 0;

    // Not when hovering an open popup of the component, e.g. a color picker:
    @at-root .dito-component:not(:has(.dito-component, .dito-popup:hover)):hover
        & {
      display: flex;
    }
  }

  // prettier-ignore
  @at-root .dito-component:hover:not(:has(.dito-component, .dito-popup:hover))
        #{$self}:has(> .dito-affix--hover) > :not(.dito-affix--hover) {
      visibility: hidden;
    }
}
</style>
