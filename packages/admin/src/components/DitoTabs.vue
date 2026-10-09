<template lang="pug">
.dito-tabs(role="tablist")
  a.dito-tabs__link(
    v-for="(tabSchema, key) in tabs"
    :id="getTabId(key)"
    :key="key"
    ref="links"
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
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoTabs', {
  emits: ['update:modelValue'],
  props: {
    tabs: { type: Object, default: null },
    modelValue: { type: String, default: null }
  },

  methods: {
    // Tabs are identified through the component path of their schema, like in
    // `DitoPane.tabId` and `tabPanelId`.
    getTabId(key) {
      return `${this.schemaComponent.componentPath}-tab-${key}`
    },

    getTabPanelId(key) {
      return `${this.schemaComponent.componentPath}-tabpanel-${key}`
    },

    // Supports the keyboard interaction of tabs with manual activation: The
    // arrow keys, Home and End move the focus to other tabs, Enter and Space
    // select the focused tab, so that moving through the tabs doesn't switch
    // their panels and the route hash on each key press.
    onKeyDown(event, key) {
      const keys = Object.keys(this.tabs)
      const index = keys.indexOf(key)
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        this.$emit('update:modelValue', key)
        return
      }
      const focusIndex = {
        ArrowLeft: (index - 1 + keys.length) % keys.length,
        ArrowRight: (index + 1) % keys.length,
        Home: 0,
        End: keys.length - 1
      }[event.key]
      if (focusIndex !== undefined) {
        event.preventDefault()
        // Refs of `v-for` elements are in the order of the rendered list:
        this.$refs.links[focusIndex]?.focus()
      }
    }
  }
})
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
