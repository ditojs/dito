<template lang="pug">
//- reka-ui moves the focus with the arrow keys, Home and End. The selected tab
//- stays the tab stop:
RovingFocusGroup(
  asChild
  orientation="horizontal"
  loop
  :currentTabStopId="modelValue"
)
  .dito-tabs(
    ref="element"
    role="tablist"
    :class=`{
      'dito-tabs--masked-start': isMaskedStart,
      'dito-tabs--masked-end': isMaskedEnd
    }`
    @scroll.passive="updateMasks"
  )
    RovingFocusItem(
      v-for="(tabSchema, key) in tabs"
      :key="key"
      asChild
      :tabStopId="key"
      :active="modelValue === key"
    )
      a.dito-tabs__link(
        :id="getTabId(key)"
        role="tab"
        :aria-selected="modelValue === key"
        :aria-controls="getTabPanelId(key)"
        :class="{ 'dito-tabs__link--active': modelValue === key }"
        @click="$emit('update:modelValue', key)"
        @keydown="onKeyDown($event, key)"
      ) {{ getLabelText(tabSchema, key) }}
</template>

<script>
import { inject, nextTick, useTemplateRef, watch } from 'vue'
import { RovingFocusGroup, RovingFocusItem } from 'reka-ui'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useScrollMask } from '../composables/useScrollMask.ts'
import { componentPathKey } from '../utils/keys.ts'

export default {
  components: { RovingFocusGroup, RovingFocusItem },
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
    const getTabId = key =>
      `${schemaComponentPath.node.componentPath}-tab-${key}`

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
        return `${schemaComponentPath.node.componentPath}-tabpanel-${key}`
      },

      // Manual activation: Enter and Space select, to not switch the panels
      // and URL each time the focus moves:
      onKeyDown(event, key) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          emit('update:modelValue', key)
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
