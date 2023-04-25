<template lang="pug">
.dito-tabs
  template(
    v-for="(tabSchema, key) in tabs"
  )
    RouterLink.dito-link(
      v-if="shouldRenderSchema(tabSchema)"
      :key="key"
      :to="{ hash: `#${key}` }"
      :class="{ 'dito-active': selectedTab === key }"
    ) {{ getLabel(tabSchema, key) }}
</template>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoTabs', {
  props: {
    tabs: { type: Object, default: null },
    selectedTab: { type: String, default: null }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

$tab-color-background: $color-lightest;
$tab-color-inactive: $color-light;
$tab-color-active: $color-lightest;
$tab-color-hover: $color-white;

.dito-tabs {
  // See: https://codepen.io/tholex/pen/hveBx/
  margin-left: auto;

  a {
    display: block;
    @include user-select(none);

    background: $tab-color-inactive;
    padding: $tab-padding-ver $tab-padding-hor;
    margin-left: $tab-margin;
    border-top-left-radius: $tab-radius;
    border-top-right-radius: $tab-radius;

    &:hover {
      background: $tab-color-hover;
    }

    &:active {
      background: $tab-color-active;
    }

    &.dito-active {
      background: $tab-color-background;
    }
  }
}
</style>
