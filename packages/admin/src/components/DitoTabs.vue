<template lang="pug">
.dito-tabs
  template(
    v-for="(tabSchema, key) in tabs"
  )
    a.dito-link(
      v-if="shouldRenderSchema(tabSchema)"
      :key="key"
      :class="{ 'dito-active': modelValue === key }"
      @click="$emit('update:modelValue', key)"
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
  }
})
</script>

<style lang="scss">
@use 'sass:color';
@import '../styles/_imports';

.dito-tabs {
  display: flex;

  .dito-link {
    display: block;
    @include user-select(none);

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

      &.dito-active {
        background: $color-lightest;
      }
    }

    // When inside a inline schema:
    .dito-schema-inlined & {
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

      &.dito-active {
        background: $color-active;
        border-color: color.adjust($color-active, $lightness: -10%);
        color: $color-white;
        z-index: 1;
      }
    }
  }
}
</style>
