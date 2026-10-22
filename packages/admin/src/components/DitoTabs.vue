<template lang="pug">
.dito-tabs(
  ref="element"
  role="tablist"
  :class=`{
    'dito-tabs--masked-start': isMaskedStart,
    'dito-tabs--masked-end': isMaskedEnd
  }`
  @scroll.passive="updateMasks"
)
  a.dito-tabs__link(
    v-for="(tabSchema, key) in tabs"
    :id="getTabId(key)"
    :key="key"
    role="tab"
    :aria-selected="modelValue === key"
    :aria-controls="getTabPanelId(key)"
    :tabindex="modelValue === key ? 0 : -1"
    :class="{ 'dito-tabs__link--active': modelValue === key }"
    @click="$emit('update:modelValue', key)"
    @keydown="onKeyDown($event, key)"
  ) {{ getLabelText(tabSchema, key) }}
</template>

<script>
import { inject, nextTick, useTemplateRef, watch } from 'vue'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useScrollMask } from '../composables/useScrollMask.ts'
import { componentPathKey } from '../utils/keys.ts'

export default {
  emits: ['update:modelValue'],

  props: {
    tabs: { type: Object, default: null },
    modelValue: { type: String, default: null },
    // The context of the schema, for the callbacks of the tabs:
    context: { type: Object, required: true }
  },

  setup(props, { emit }) {
    // Identify tabs through the component path of their schema, like panes:
    const schemaComponentPath = inject(componentPathKey)
    const getTabId = key => `${schemaComponentPath.path}-tab-${key}`

    // The tabs scroll where the header is too narrow for them:
    const element = useTemplateRef('element')
    const {
      isMaskedStart,
      isMaskedEnd,
      update: updateMasks
    } = useScrollMask(element)
    // Scroll the selected tab into view, clear of the fades, but not the tabs
    // themselves, as `scrollIntoView()` would:
    watch(
      () => props.modelValue,
      async key => {
        await nextTick()
        const tab = document.getElementById(getTabId(key))
        if (tab) {
          const bounds = element.value.getBoundingClientRect()
          const { left, right } = tab.getBoundingClientRect()
          const padding = parseFloat(
            getComputedStyle(element.value).scrollPaddingLeft
          )
          const offset = (
            Math.min(left - bounds.left - padding, 0) +
            Math.max(right - bounds.right + padding, 0)
          )
          element.value.scrollLeft += offset
        }
      },
      { immediate: true, flush: 'post' }
    )

    return {
      getTabId,
      isMaskedStart,
      isMaskedEnd,
      updateMasks,
      getLabelText: useSchemaValue(props.context).getLabelText,

      getTabPanelId(key) {
        return `${schemaComponentPath.path}-tabpanel-${key}`
      },

      // Manual activation: Arrow keys, Home and End only move the focus, Enter
      // and Space select, to not switch the panels and URL on each key press.
      onKeyDown(event, key) {
        const keys = Object.keys(props.tabs)
        const index = keys.indexOf(key)
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          emit('update:modelValue', key)
        } else {
          const focusIndex = {
            ArrowLeft: (index - 1 + keys.length) % keys.length,
            ArrowRight: (index + 1) % keys.length,
            Home: 0,
            End: keys.length - 1
          }[event.key]
          if (focusIndex !== undefined) {
            event.preventDefault()
            document.getElementById(getTabId(keys[focusIndex]))?.focus()
          }
        }
      }
    }
  }
}
</script>

<style lang="scss">
@use 'sass:color';
@import '../styles/_imports';

.dito-tabs {
  $self: &;

  display: flex;

  // Keep `.dito-tabs` last for the modifiers that `scroll-mask` adds:
  &--header#{&} {
    min-width: 0;
    @include scroll-mask;
  }

  &__link {
    @include user-select(none);

    display: block;
    white-space: nowrap;

    &:hover {
      background: $color-white;
    }

    // When in main header:
    #{$self}--header & {
      background: $color-light;
      padding: $tab-padding-ver $tab-padding-hor;
      margin-left: $tab-margin;
      border-top-left-radius: $tab-radius;
      border-top-right-radius: $tab-radius;

      &:active {
        background: $color-lightest;
      }

      &--active {
        background: $color-lightest;
      }
    }

    // When inside a inline schema:
    #{$self}--inlined & {
      background: $color-lighter;
      border: $border-style;
      padding: $input-padding;
      margin-left: -$border-width;
      white-space: nowrap;

      &:first-child {
        border-top-left-radius: $tab-radius;
        border-bottom-left-radius: $tab-radius;
      }

      &:last-child {
        border-top-right-radius: $tab-radius;
        border-bottom-right-radius: $tab-radius;
      }

      &:active {
        background: $color-lighter;
      }

      &--active {
        background: $color-active;
        border-color: color.adjust($color-active, $lightness: -10%);
        color: $color-white;
        z-index: 1;
      }
    }
  }
}
</style>
