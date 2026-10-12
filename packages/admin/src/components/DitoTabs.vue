<template lang="pug">
.dito-tabs(role="tablist")
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
  ) {{ getLabel(tabSchema, key) }}
</template>

<script>
import { inject } from 'vue'
import { useSchemaValue } from '../composables/useSchemaValue.ts'

export default {
  name: 'DitoTabs',
  emits: ['update:modelValue'],

  props: {
    tabs: { type: Object, default: null },
    modelValue: { type: String, default: null },
    // The context of the schema, for the callbacks of the tabs:
    context: { type: Object, required: true }
  },

  setup(props, { emit }) {
    // Identify tabs through the component path of their schema, like panes:
    const schemaComponentPath = inject('componentPath')
    const getTabId = key => `${schemaComponentPath.path}-tab-${key}`

    return {
      getTabId,
      getLabel: useSchemaValue(props.context).getLabel,

      getTabPanelId(key) {
        return `${schemaComponentPath.path}-tabpanel-${key}`
      },

      // Manual activation: Arrow keys, Home and End only move the focus, Enter
      // and Space select, to not switch the panels and hash on each key press.
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
  display: flex;

  &__link {
    @include user-select(none);

    display: block;
    white-space: nowrap;

    &:hover {
      background: $color-white;
    }

    // When in main header:
    .dito-header & {
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
    .dito-schema-inlined &,
    .dito-label & {
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

  .dito-schema & {
    // Push clipboard to the right in the flex layout, see:
    // https://codepen.io/tholex/pen/hveBx/
    margin-left: auto;

    &:last-child {
      margin-right: auto;
    }
  }
}
</style>
